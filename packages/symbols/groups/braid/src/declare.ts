import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { integerAt, operandsOf, stringAt } from "@enumeratio/boxed";
import {
  alexanderPolynomial,
  type Braid,
  braid,
  braidPower,
  burau,
  components,
  compose,
  crossings,
  invert,
  isKnot,
  isPositive,
  permutationOf,
  positiveBraidGenus,
  positivePermutationBraid,
  torusAlexander,
  torusBraid,
  writhe,
} from "./braid.ts";
import { bracketInvariant, jonesPolynomial, kauffmanBracket, torusJones } from "./jones.ts";
import {
  type Knot,
  pretzelAlexander,
  pretzelGenus,
  pretzelKnot,
  torusGenus,
  torusKnot,
  twistAlexander,
  twistGenus,
  twistKnot,
} from "./knot.ts";
import { lorenzCurve, type Point3, torusKnotCurve } from "./curve.ts";
import { type Laurent, trim } from "./laurent.ts";
import { lorenzBraid, lorenzPermutation, tripNumber } from "./lorenz.ts";

// Wiring braids to compute-engine.
//
// A braid is `Braid(strands, [w₁, …])`, where a letter k means σ_k and −k means σ_k⁻¹.
// Knot polynomials come back as ordinary expressions in `t`, not as coefficient lists, so
// they can be added, factored and evaluated like anything else.

const integerListOf = (expr: BoxedExpression | undefined): number[] | undefined => {
  if (expr === undefined || expr.operator !== "List") return undefined;
  const values = operandsOf(expr).map(integerAt);
  return values.every((x): x is number => x !== undefined) ? values : undefined;
};

/** Read `Braid(strands, [...])`, a `TorusBraid`, or a modular word's Lorenz braid. */
function braidOf(expr: BoxedExpression | undefined): Braid | undefined {
  if (expr === undefined) return undefined;
  const word = stringAt(expr);
  if (word !== undefined && /^[LR]+$/.test(word)) return lorenzBraid(word);
  if (expr.operator !== "Braid") return undefined;
  const ops = operandsOf(expr);
  const strands = integerAt(ops[0]);
  const letters = integerListOf(ops[1]) ?? (ops.length === 1 ? [] : undefined);
  return strands === undefined || letters === undefined ? undefined : braid(strands, letters);
}

/**
 * Read a knot from whatever names it: `TorusKnot(p, q)`, `TwistKnot(n)`,
 * `PretzelKnot(p, q, r)`, `FigureEightKnot()`, a braid (whose closure it is), or a
 * modular word. A head that wants an invariant of a knot takes any of these, and picks
 * its route from what the knot turned out to carry.
 */
function knotOf(expr: BoxedExpression | undefined): Knot | undefined {
  if (expr?.operator === "TorusKnot") {
    const ops = operandsOf(expr);
    const [p, q] = [integerAt(ops[0]), integerAt(ops[1])];
    return p === undefined || q === undefined ? undefined : torusKnot(p, q);
  }
  if (expr?.operator === "TwistKnot") {
    const n = integerAt(operandsOf(expr)[0]);
    return n === undefined ? undefined : twistKnot(n);
  }
  if (expr?.operator === "PretzelKnot") {
    const ops = operandsOf(expr);
    const [p, q, r] = [integerAt(ops[0]), integerAt(ops[1]), integerAt(ops[2])];
    return p === undefined || q === undefined || r === undefined ? undefined : pretzelKnot(p, q, r);
  }
  // n = 1: one full twist past the clasp is two half-twists, which is the figure-eight.
  if (expr?.operator === "FigureEightKnot") return twistKnot(1);
  const b = braidOf(expr);
  return b === undefined ? undefined : { braid: b };
}

export function declareBraid(ce: ComputeEngine): void {
  const braidExpression = (b: Braid): BoxedExpression =>
    ce.function("Braid", [
      ce.number(b.strands),
      ce.function(
        "List",
        b.word.map((k) => ce.number(k)),
      ),
    ]);

  const listExpression = (values: readonly number[]): BoxedExpression =>
    ce.function(
      "List",
      values.map((x) => ce.number(x)),
    );

  /** A Laurent polynomial as an ordinary expression, so it behaves like algebra. */
  const polynomialIn = (variable: string, p: Laurent): BoxedExpression => {
    const trimmed = trim(p);
    if (trimmed.coefficients.length === 0) return ce.number(0);
    const terms = trimmed.coefficients
      .map((coefficient, index) => ({ coefficient, exponent: trimmed.offset + index }))
      .filter(({ coefficient }) => coefficient !== 0)
      .map(({ coefficient, exponent }) => {
        const powerPart =
          exponent === 0
            ? undefined
            : exponent === 1
              ? ce.symbol(variable)
              : ce.function("Power", [ce.symbol(variable), ce.number(exponent)]);
        if (powerPart === undefined) return ce.number(coefficient);
        return coefficient === 1
          ? powerPart
          : ce.function("Multiply", [ce.number(coefficient), powerPart]);
      });
    return terms.length === 1 ? (terms[0] as BoxedExpression) : ce.function("Add", terms);
  };
  const polynomialExpression = (p: Laurent): BoxedExpression => polynomialIn("t", p);

  ce.declare("Braid", { signature: "(integer, list?) -> value" });

  /** A head taking a braid and returning a value. */
  const aboutBraid = (
    head: string,
    signature: string,
    answer: (b: Braid) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const b = braidOf(ops[0]);
        return b === undefined ? undefined : answer(b);
      },
    });
  };

  /** A head taking an LR word. */
  const aboutWord = (
    head: string,
    signature: string,
    answer: (word: string) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const word = stringAt(ops[0]);
        return word === undefined || !/^[LR]+$/.test(word) ? undefined : answer(word);
      },
    });
  };

  /** A head taking a knot, however that knot was named. */
  const aboutKnot = (
    head: string,
    signature: string,
    answer: (k: Knot) => BoxedExpression | undefined,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const k = knotOf(ops[0]);
        return k === undefined ? undefined : answer(k);
      },
    });
  };

  // ── the group ───────────────────────────────────────────────────────────────

  ce.declare("BraidProduct", {
    signature: "(value, value) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [a, b] = [braidOf(ops[0]), braidOf(ops[1])];
      if (a === undefined || b === undefined) return undefined;
      const product = compose(a, b);
      return product === undefined ? undefined : braidExpression(product);
    },
  });
  aboutBraid("BraidInverse", "(value) -> value", (b) => braidExpression(invert(b)));
  ce.declare("BraidPower", {
    signature: "(value, integer) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const b = braidOf(ops[0]);
      const k = integerAt(ops[1]);
      if (b === undefined || k === undefined) return undefined;
      const result = braidPower(b, k);
      return result === undefined ? undefined : braidExpression(result);
    },
  });
  aboutBraid("BraidStrands", "(value) -> integer", (b) => ce.number(b.strands));
  aboutBraid("BraidCrossings", "(value) -> integer", (b) => ce.number(crossings(b)));
  /** The exponent sum: the abelianisation B_n → Z, and the closed diagram's writhe. */
  aboutBraid("BraidWrithe", "(value) -> integer", (b) => ce.number(writhe(b)));
  aboutBraid("BraidIsPositive", "(value) -> boolean", (b) =>
    ce.symbol(isPositive(b) ? "True" : "False"),
  );
  /** The image in the symmetric group — forget which strand went over. */
  aboutBraid("BraidPermutation", "(value) -> list", (b) =>
    listExpression(permutationOf(b).map((i) => i + 1)),
  );

  // ── the closure, and its invariants ─────────────────────────────────────────

  aboutBraid("BraidComponents", "(value) -> integer", (b) => ce.number(components(b)));
  aboutBraid("BraidIsKnot", "(value) -> boolean", (b) => ce.symbol(isKnot(b) ? "True" : "False"));
  /**
   * The closed-form genus of a knot named by one — the value each family's own function
   * knows without any braid at all.
   */
  const closedGenus = (k: Knot): number | undefined => {
    const c = k.closed;
    if (c === undefined) return undefined;
    if (c.kind === "torus") return torusGenus(c.torus.p, c.torus.q);
    if (c.kind === "twist") return twistGenus(c.twist.n);
    return pretzelGenus(c.pretzel.p, c.pretzel.q, c.pretzel.r);
  };
  /**
   * The Seifert genus of the knot: the closed form for a named torus, twist or pretzel
   * knot, otherwise Bennequin on a positive braid's closure, (c − s + 1)/2.
   */
  aboutKnot("SeifertGenus", "(value) -> integer", (k) => {
    const genus =
      closedGenus(k) ?? (k.braid === undefined ? undefined : positiveBraidGenus(k.braid));
    return genus === undefined ? undefined : ce.number(genus);
  });
  /**
   * The closed-form Alexander polynomial of a knot named by one, before falling back to
   * Burau.
   */
  const closedAlexander = (k: Knot): Laurent | undefined => {
    const c = k.closed;
    if (c === undefined) return undefined;
    if (c.kind === "torus") return torusAlexander(c.torus.p, c.torus.q);
    if (c.kind === "twist") return twistAlexander(c.twist.n);
    return pretzelAlexander(c.pretzel.p, c.pretzel.q, c.pretzel.r);
  };
  /** The Alexander polynomial of the closure, via the reduced Burau representation. */
  aboutKnot("AlexanderPolynomial", "(value) -> expression", (k) => {
    // A named torus, twist or pretzel knot has a closed form; anything else goes through
    // Burau.
    const closed = closedAlexander(k);
    if (closed !== undefined) return polynomialExpression(closed);
    const b = k.braid;
    if (b === undefined) return undefined;
    const polynomial = alexanderPolynomial(b);
    return polynomial === undefined ? undefined : polynomialExpression(polynomial);
  });
  aboutBraid("BurauMatrix", "(value) -> list", (b) => {
    const matrix = burau(b);
    return matrix === undefined
      ? undefined
      : ce.function(
          "List",
          matrix.map((row) => ce.function("List", row.map(polynomialExpression))),
        );
  });

  // ── named braids ────────────────────────────────────────────────────────────

  /** (σ₁ ⋯ σ_{p−1})^q in B_p, whose closure is the torus link T(p, q). */
  ce.declare("TorusBraid", {
    signature: "(integer, integer) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const [p, q] = [integerAt(ops[0]), integerAt(ops[1])];
      if (p === undefined || q === undefined) return undefined;
      const b = torusBraid(p, q);
      return b === undefined ? undefined : braidExpression(b);
    },
  });
  /**
   * T(p, q) as a knot rather than a braid — inert, like `Braid`, because it is a value
   * and not a computation. The invariant heads take it and use the closed forms.
   */
  ce.declare("TorusKnot", { signature: "(integer, integer) -> value" });
  /** The twist knot with n half-twists past its clasp — n = 1 is the figure-eight. */
  ce.declare("TwistKnot", { signature: "(integer) -> value" });
  /** The pretzel knot P(p, q, r), for odd p, q, r. */
  ce.declare("PretzelKnot", { signature: "(integer, integer, integer) -> value" });
  /** The figure-eight knot — `TwistKnot(1)` under its own name. */
  ce.declare("FigureEightKnot", { signature: "() -> value" });
  /** The unique positive braid realising a permutation, with no pair crossing twice. */
  ce.declare("PositivePermutationBraid", {
    signature: "(list) -> value",
    evaluate: (ops: readonly BoxedExpression[]) => {
      const values = integerListOf(ops[0]);
      if (values === undefined) return undefined;
      const b = positivePermutationBraid(values.map((x) => x - 1));
      return b === undefined ? undefined : braidExpression(b);
    },
  });

  // ── the Jones polynomial ────────────────────────────────────────────────────

  /**
   * V(t) of the knot: the closed form when it was named T(p, q), otherwise the
   * Temperley–Lieb image of a braid presenting it. The two agree — that is what the
   * tests check — so which route ran is an implementation detail, not a different head.
   */
  aboutKnot("JonesPolynomial", "(value) -> expression", (k) => {
    // Only the torus family has a closed Jones form; a twist or pretzel knot's V comes
    // from whatever braid it carries, when it carries one.
    const closed =
      k.closed?.kind === "torus" ? torusJones(k.closed.torus.p, k.closed.torus.q) : undefined;
    if (closed !== undefined) return polynomialExpression(closed);
    const polynomial = k.braid === undefined ? undefined : jonesPolynomial(k.braid);
    return polynomial === undefined ? undefined : polynomialExpression(polynomial);
  });
  /** The Kauffman bracket, in A — defined for links too, where V needs a root of t. */
  aboutKnot("KauffmanBracket", "(value) -> expression", (k) => {
    const bracket = k.braid === undefined ? undefined : kauffmanBracket(k.braid);
    return bracket === undefined ? undefined : polynomialIn("A", bracket);
  });
  /** The writhe-corrected bracket (−A³)^{−w}⟨L⟩, already an invariant. */
  aboutKnot("BracketInvariant", "(value) -> expression", (k) => {
    const invariant = k.braid === undefined ? undefined : bracketInvariant(k.braid);
    return invariant === undefined ? undefined : polynomialIn("A", invariant);
  });

  // ── the Lorenz bridge ───────────────────────────────────────────────────────

  /** The Lorenz braid of a modular geodesic's LR word — the knot the geodesic draws. */
  // ── knots as curves in space ────────────────────────────────────────────────
  // A list of points, so a figure is something an expression *evaluates to* rather
  // than something an element is configured to draw.
  const pointList = (points: readonly Point3[]) =>
    ce.function(
      "List",
      points.map((p) =>
        ce.function(
          "List",
          p.map((v) => ce.number(v)),
        ),
      ),
    );

  /**
   * Where a knot goes, as opposed to what it is: the points its embedding passes
   * through. The head names the operation and the argument names the knot, the same
   * way the invariants do -- so a knot family does not need a curve head of its own.
   *
   * Only the torus parameterisation is known so far. A knot named any other way has no
   * embedding here and declines, rather than guessing one from a braid word.
   */
  ce.declare("KnotCurve", {
    signature: "(value, integer?) -> list",
    evaluate: (ops) => {
      const closed = knotOf(ops[0])?.closed;
      if (closed?.kind !== "torus") return undefined;
      const samples = Number.isFinite(ops[1]?.re) ? (ops[1] as BoxedExpression).re : 600;
      return pointList(torusKnotCurve(closed.torus.p, closed.torus.q, samples));
    },
  });

  // Compile each coordinate to native JS once, then sample it -- a subs()+N() per
  // point costs ~200x more, which a Manipulate slider feels immediately. Anything the
  // compiler has no lowering for (special functions reaching for the analytic runtime)
  // falls back to symbolic evaluation, correct but slow.
  const samplers = new Map<string, (t: number) => number>();
  const sampler = (e: BoxedExpression): ((t: number) => number) => {
    // Keyed on the expression, since a slider re-evaluates the same coordinates every
    // frame and compiling costs more than the whole sampling loop.
    const key = e.canonical.toString();
    const hit = samplers.get(key);
    if (hit) return hit;
    const fn = build(e);
    if (samplers.size > 64) samplers.clear();
    samplers.set(key, fn);
    return fn;
  };

  const build = (e: BoxedExpression): ((t: number) => number) => {
    try {
      const r = new JavaScriptTarget().compile(e.canonical) as {
        success?: boolean;
        run?: (scope: Record<string, unknown>) => unknown;
      };
      if (r?.success && typeof r.run === "function") {
        const run = r.run;
        const scope: Record<string, unknown> = {};
        return (t) => {
          scope.t = t;
          const v = run(scope);
          return typeof v === "number" ? v : Number.NaN;
        };
      }
    } catch {
      /* fall through to symbolic sampling */
    }
    return (t) => {
      const v = e.subs({ t: ce.number(t) }).N().re;
      return typeof v === "number" ? v : Number.NaN;
    };
  };

  ce.declare("ParametricCurve", {
    signature: "(any, any, any, number?, number?) -> list",
    // The curve as its own equation: three coordinate expressions in `t`, sampled.
    // `KnotCurve` is a convenience over exactly this, so a reader who wants to see
    // where the shape comes from can write the parameterisation out and get the same
    // picture.
    evaluate: (ops) => {
      const [x, y, z] = ops;
      if (!x || !y || !z) return undefined;
      const span = Number.isFinite(ops[3]?.re) ? (ops[3] as BoxedExpression).re : 2 * Math.PI;
      const samples = Math.max(
        24,
        Math.min(
          4000,
          Math.round(Number.isFinite(ops[4]?.re) ? (ops[4] as BoxedExpression).re : 600),
        ),
      );
      const [fx, fy, fz] = [x, y, z].map(sampler);
      const points: Point3[] = [];
      for (let i = 0; i < samples; i++) {
        const t = (span * i) / samples;
        const p: Point3 = [fx(t), fy(t), fz(t)];
        if (p.every((v) => Number.isFinite(v))) points.push(p);
      }
      return points.length >= 2 ? pointList(points) : undefined;
    },
  });

  ce.declare("LorenzCurve", {
    signature: "(integer?) -> list",
    evaluate: (ops) => {
      const steps = Number.isFinite(ops[0]?.re) ? (ops[0] as BoxedExpression).re : 5000;
      return pointList(lorenzCurve({ steps }));
    },
  });

  aboutWord("LorenzBraid", "(string) -> value", (word) => {
    const b = lorenzBraid(word);
    return b === undefined ? undefined : braidExpression(b);
  });
  aboutWord("LorenzPermutation", "(string) -> list", (word) => {
    const permutation = lorenzPermutation(word);
    return permutation === undefined ? undefined : listExpression(permutation.map((i) => i + 1));
  });
  /** The trip number: the count of LR corners, and the braid index of the Lorenz link. */
  aboutWord("TripNumber", "(string) -> integer", (word) => {
    const trips = tripNumber(word);
    return trips === undefined ? undefined : ce.number(trips);
  });
}
