import type { BoxedExpression } from "@cortex-js/compute-engine";
import { BigDecimal } from "@cortex-js/compute-engine";
import {
  type Ball,
  add,
  certify,
  div,
  exact,
  ln,
  lower,
  magnitude,
  mul,
  neg,
  sub,
  upper,
} from "./ball.ts";
import { barnesGBall, pi } from "./barnes-g-big.ts";
import { atDigits } from "./bigzeta.ts";
import { argumentBall } from "./certified.ts";
import { hurwitzZetaBall } from "./hurwitz-ball.ts";
import { lerchPhiBall } from "./lerch-big.ts";
import { stieltjesGammaBall } from "./stieltjes-big.ts";

// A head's image over an interval, proven: the route interval.ts takes for the heads whose
// critical points aren't known but whose value and first two derivatives have certified
// kernels (certified.ts, ball.ts).
//
// A kernel fed a ball returns a ball holding every value the head takes on it, so the interval
// as one wide ball would already give a rigorous image -- but a loose one: ball arithmetic
// overstates a wide input's image many times over (~20× for G), and cutting finer only closes
// that gap linearly. Derivatives close it. On a piece X = [c − h, c + h], with f′(c) at the
// point and A a ball holding f″ on all of X, Taylor's theorem with the remainder at some ξ in X
// gives, for every t with c + t in X,
//   f(c) + f′(c)·t + ½·A_lo·t²  ≤  f(c + t)  ≤  f(c) + f′(c)·t + ½·A_hi·t²,
// quadratics whose least and greatest values on the piece have closed forms. Every error in
// them is third order in h, so an extremum is closed in on after a few cuts. And when
// f′(X) ⊆ f′(c) + A·[−h, h] keeps one sign the head is monotonic on the piece, and its image
// is exactly the values at its ends.
//
// Branch and bound: only a piece whose image reaches below the least value known to be taken
// (or above the greatest) could hide the image's end, so only such pieces are cut, the one
// reaching furthest first; the values known to be taken are those at the ends and every cut.
// The search stops when no piece reaches more than `TOLERANCE` past them, or when `BUDGET`
// evaluations are spent. The image, the hull of every piece's, is rigorous either way, but it
// is only given when it is tight (`ACCEPTED`): an image proven too loose to be useful is left
// to sampling, as for the heads without certified derivatives.

/** Digits the balls are carried at: well past a double, whose digits the image is given in. */
const DIGITS = 25;

/** Kernel evaluations one image may spend. */
const BUDGET = 200;

/** How far past a value taken, relative to the image's size, a piece may reach and be left. */
const TOLERANCE = new BigDecimal("1e-13");

/** How far past, relative, the image may still reach when the budget runs out, and be given.
 * Past this the kernels' balls are too loose on the interval to settle it -- a series whose
 * terms grow before they fall, summed over a wide ball, overstates by orders of magnitude --
 * and the image is left to sampling rather than given uselessly wide. */
const ACCEPTED = new BigDecimal("1e-9");

/** Digits a cut point keeps: pieces meet exactly at it, so any value will do, and a short one
 * keeps the balls' digits from growing with every cut. */
const CUT_DIGITS = 20;

/** Significant digits the image's ends are given in: a decimal of 15 digits survives the round
 * trip through a double exactly, so the ends mean what they say. */
const END_DIGITS = 15;

/** A head's value and first two derivatives in one argument, each on balls for all the
 * arguments, as balls holding them -- undefined where a kernel declines. */
interface Differentiable {
  readonly arity: number;
  readonly argIndex: number;
  readonly value: (args: readonly Ball[]) => Ball | undefined;
  readonly slope: (args: readonly Ball[]) => Ball | undefined;
  readonly curvature: (args: readonly Ball[]) => Ball | undefined;
}

/** The step k that takes x right of 0: ψ and ψ₁ are certified there, and recur to the left. */
const shift = (x: Ball): number =>
  lower(x).isPositive() ? 0 : Math.ceil(-lower(x).toNumber()) + 1;

/** ψ(x) = −γ₀(x) for x > 0 (stieltjes-big.ts); ψ(x) = ψ(x + k) − Σ_{j<k} 1/(x + j). */
function digamma(x: Ball): Ball | undefined {
  const k = shift(x);
  const gamma0 = stieltjesGammaBall(0, add(x, exact(k)), BigDecimal.precision);
  if (gamma0 === undefined) return undefined;
  let psi = neg(gamma0);
  for (let j = 0; j < k; j++) psi = sub(psi, div(exact(1), add(x, exact(j))));
  return psi;
}

/** ψ₁(x) = ζ(2, x) for x > 0 (hurwitz-ball.ts); ψ₁(x) = ψ₁(x + k) + Σ_{j<k} 1/(x + j)². */
function trigamma(x: Ball): Ball | undefined {
  const k = shift(x);
  let psi1 = hurwitzZetaBall(exact(2), add(x, exact(k)), BigDecimal.precision);
  if (psi1 === undefined) return undefined;
  for (let j = 0; j < k; j++) {
    const w = add(x, exact(j));
    psi1 = add(psi1, div(exact(1), mul(w, w)));
  }
  return psi1;
}

/** L′ = (ln G)′(x) = (x − 1)ψ(x) − x + (1 + ln 2π)/2. */
function logBarnesSlope(x: Ball): Ball | undefined {
  const psi = digamma(x);
  if (psi === undefined) return undefined;
  const constant = div(add(exact(1), ln(mul(pi(), exact(2)))), exact(2));
  return add(sub(mul(sub(x, exact(1)), psi), x), constant);
}

/** L″ = (ln G)″(x) = ψ(x) + (x − 1)ψ₁(x) − 1. */
function logBarnesCurvature(x: Ball): Ball | undefined {
  const psi = digamma(x);
  const psi1 = trigamma(x);
  if (psi === undefined || psi1 === undefined) return undefined;
  return sub(add(psi, mul(sub(x, exact(1)), psi1)), exact(1));
}

/** Φ(z, s, a) for the working precision. */
const lerch = (z: Ball, s: Ball, a: number): Ball | undefined =>
  lerchPhiBall(z, s, exact(a), BigDecimal.precision);

const DIFFERENTIABLE: Readonly<Record<string, Differentiable>> = {
  // G′ = G·L′ and G″ = G·(L″ + L′²), L = ln G.
  BarnesG: {
    arity: 1,
    argIndex: 0,
    value: ([x]) => barnesGBall(x!, BigDecimal.precision),
    slope: ([x]) => {
      const g = barnesGBall(x!, BigDecimal.precision);
      const s = logBarnesSlope(x!);
      return g && s && mul(g, s);
    },
    curvature: ([x]) => {
      const g = barnesGBall(x!, BigDecimal.precision);
      const s = logBarnesSlope(x!);
      const c = logBarnesCurvature(x!);
      return g && s && c && mul(g, add(c, mul(s, s)));
    },
  },
  // ln G for x > 0 only, as its certified kernel.
  LogBarnesG: {
    arity: 1,
    argIndex: 0,
    value: ([x]) => {
      if (!lower(x!).isPositive()) return undefined;
      const g = barnesGBall(x!, BigDecimal.precision);
      return g && ln(g);
    },
    slope: ([x]) => (lower(x!).isPositive() ? logBarnesSlope(x!) : undefined),
    curvature: ([x]) => (lower(x!).isPositive() ? logBarnesCurvature(x!) : undefined),
  },
  // Liₛ(z) = z·Φ(z, s, 1) = Σ_{n≥1} zⁿ/nˢ, so term by term
  //   Liₛ′(z) = Σ_{m≥0} z^m/(m+1)^{s−1} = Φ(z, s − 1, 1),
  //   Liₛ″(z) = Σ_{m≥0} (m+1) z^m/(m+2)^{s−1} = Φ(z, s − 2, 2) − Φ(z, s − 1, 2).
  PolyLog: {
    arity: 2,
    argIndex: 1,
    value: ([s, z]) => {
      const phi = lerch(z!, s!, 1);
      return phi && mul(z!, phi);
    },
    slope: ([s, z]) => lerch(z!, sub(s!, exact(1)), 1),
    curvature: ([s, z]) => {
      const first = lerch(z!, sub(s!, exact(2)), 2);
      const second = lerch(z!, sub(s!, exact(1)), 2);
      return first && second && sub(first, second);
    },
  },
};

/** The heads `ballImage` can prove an image for, with the argument an interval may occupy. */
export const PROVEN_IMAGE_HEADS: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(DIFFERENTIABLE).map(([head, { argIndex }]) => [head, argIndex]),
);

interface Piece {
  readonly from: BigDecimal;
  readonly to: BigDecimal;
  /** A ball holding every value on [from, to], or undefined where the kernels decline a
   * ball this wide -- such a piece is cut first. */
  readonly image: Ball | undefined;
}

/** `head(ops)`'s image with `ops[argIndex]` running over [l, h], as rigorous ends rounded
 * outward to `END_DIGITS`, or undefined when `head` has no certified derivatives in that
 * argument, an argument or an end isn't exact, or the kernels can't cover the interval (a
 * pole in it, or past their reach). */
export function ballImage(
  head: string,
  ops: readonly BoxedExpression[],
  argIndex: number,
  l: BoxedExpression,
  h: BoxedExpression,
): { readonly lo: BigDecimal; readonly hi: BigDecimal } | undefined {
  const differentiable = DIFFERENTIABLE[head];
  if (
    differentiable === undefined ||
    differentiable.arity !== ops.length ||
    differentiable.argIndex !== argIndex
  ) {
    return undefined;
  }
  return atDigits(DIGITS, () => {
    const fixed = ops.map((op, i) => (i === argIndex ? exact(0) : argumentBall(op)));
    const [a, b] = [argumentBall(l), argumentBall(h)];
    if (a === undefined || b === undefined || fixed.some((arg) => arg === undefined)) {
      return undefined;
    }
    const [from, to] = [lower(a), upper(b)];
    if (from.gt(to)) return undefined;
    const withArg = (x: Ball) => fixed.map((arg, i) => (i === argIndex ? x : arg!));
    let spent = 0;
    const call = (kernel: (args: readonly Ball[]) => Ball | undefined, x: Ball) => {
      spent++;
      return certify(() => kernel(withArg(x)));
    };
    const values = new Map<string, Ball | undefined>();
    /** The head at the point x, a ball of radius 0 -- each point evaluated once. */
    const at = (x: BigDecimal): Ball | undefined => {
      const key = x.toString();
      if (!values.has(key)) values.set(key, call(differentiable.value, exact(x)));
      return values.get(key);
    };
    /** [from, to] with a ball holding the head's every value on it, where the kernels give
     * one (see the header). */
    const over = (from: BigDecimal, to: BigDecimal): Piece => {
      // The curvature over the whole piece first: it is what a piece too wide for the kernels
      // declines, and then nothing else is worth paying for.
      const curvature = call(differentiable.curvature, span(from, to));
      if (curvature === undefined) return { from, to, image: undefined };
      const [start, end] = [at(from), at(to)];
      const c = middle(from, to);
      const [value, slope] = [at(c), call(differentiable.slope, exact(c))];
      if ([start, end, value, slope].includes(undefined)) return { from, to, image: undefined };
      const [below, above] = [c.sub(from), to.sub(c)];
      // f′ on the piece lies within f′(c) ± |A|·h: one sign there, and f is monotonic.
      const drift = magnitude(curvature!).mul(below.gt(above) ? below : above);
      if (lower(slope!).gt(drift) || upper(slope!).neg().gt(drift)) {
        return { from, to, image: hull(start!, end!) };
      }
      const least = lower(value!).add(extreme(slope!, lower(curvature!), below, above, "least"));
      const most = upper(value!).add(extreme(slope!, upper(curvature!), below, above, "most"));
      return { from, to, image: span(least, most) };
    };

    // The ends are taken first: they are the image's ends wherever the head is monotonic.
    if (at(from) === undefined || at(to) === undefined) return undefined;
    let pieces: Piece[] = [over(from, to)];
    for (;;) {
      // The least and greatest values known to be taken: every piece's ends were evaluated.
      const taken = [...values.values()].filter((v): v is Ball => v !== undefined);
      const least = taken.map(upper).reduce((x, y) => (y.lt(x) ? y : x));
      const greatest = taken.map(lower).reduce((x, y) => (y.gt(x) ? y : x));
      const size = least.abs().gt(greatest.abs()) ? least.abs() : greatest.abs();
      const slack = size.isZero() ? new BigDecimal("1e-30") : size.mul(TOLERANCE);
      /** How far `piece` reaches past the values taken, less the slack: ≤ 0 to leave it. */
      const reach = ({ image }: Piece): BigDecimal => {
        if (image === undefined) return BigDecimal.POSITIVE_INFINITY;
        const below = least.sub(lower(image));
        const above = upper(image).sub(greatest);
        return (below.gt(above) ? below : above).sub(slack);
      };
      const worst = pieces.reduce((x, y) => (reach(y).gt(reach(x)) ? y : x));
      if (!reach(worst).isPositive()) break;
      const cut = middle(worst.from, worst.to);
      // Out of budget, or a piece too narrow to cut: done, if the image is tight enough.
      if (spent > BUDGET || !cut.gt(worst.from) || !cut.lt(worst.to)) {
        if (reach(worst).gt(size.mul(ACCEPTED))) return undefined;
        break;
      }
      pieces = [
        ...pieces.filter((piece) => piece !== worst),
        over(worst.from, cut),
        over(cut, worst.to),
      ];
    }
    const images = pieces.map(({ image }) => image);
    if (!images.every((image) => image !== undefined)) return undefined;
    const lo = images.map(lower).reduce((x, y) => (y.lt(x) ? y : x));
    const hi = images.map(upper).reduce((x, y) => (y.gt(x) ? y : x));
    return {
      lo: lo.toPrecisionToward(END_DIGITS, "floor"),
      hi: hi.toPrecisionToward(END_DIGITS, "ceiling"),
    };
  });
}

/**
 * The least (or greatest) of p·t + ½·a·t² over t ∈ [−below, above], taken at the worst p in
 * the ball `slope` -- a lower bound on the least, an upper bound on the greatest. For t ≥ 0
 * the worst p is slope's lower end (least) or upper end (most), and the reverse for t ≤ 0, so
 * each side is a quadratic αt + βt², β = a/2, whose extreme on the side is at its ends or, when
 * it opens the right way, at its vertex, where it is −α²/(4β): rounded outward, so a vertex
 * outside the side only loosens the bound, never breaks it.
 */
function extreme(
  slope: Ball,
  a: BigDecimal,
  below: BigDecimal,
  above: BigDecimal,
  kind: "least" | "most",
): BigDecimal {
  const beta = a.mul(BigDecimal.HALF);
  const pick = (x: BigDecimal, y: BigDecimal) =>
    kind === "least" ? (y.lt(x) ? y : x) : y.gt(x) ? y : x;
  const side = (alpha: BigDecimal, t: BigDecimal): BigDecimal => {
    const candidates = [BigDecimal.ZERO, alpha.mul(t).add(beta.mul(t).mul(t))];
    const opens = kind === "least" ? beta.isPositive() : beta.isNegative();
    if (opens) {
      const direction = kind === "least" ? "floor" : "ceiling";
      candidates.push(alpha.mul(alpha).neg().divToward(beta.mul(4), direction));
    }
    return candidates.reduce(pick);
  };
  const [low, high] = [lower(slope), upper(slope)];
  return pick(
    side(kind === "least" ? low : high, above),
    side(kind === "least" ? high : low, below.neg()),
  );
}

/** [from, to] as a ball, exactly: its midpoint and half-width are exact decimals. */
const span = (from: BigDecimal, to: BigDecimal): Ball => ({
  mid: from.add(to).mul(BigDecimal.HALF),
  rad: to.sub(from).mul(BigDecimal.HALF),
});

/** A short decimal near the middle of [from, to]. */
const middle = (from: BigDecimal, to: BigDecimal): BigDecimal =>
  from.add(to).mul(BigDecimal.HALF).toPrecision(CUT_DIGITS);

/** The smallest ball holding both. */
function hull(x: Ball, y: Ball): Ball {
  const least = lower(x).lt(lower(y)) ? lower(x) : lower(y);
  const greatest = upper(x).gt(upper(y)) ? upper(x) : upper(y);
  return span(least, greatest);
}
