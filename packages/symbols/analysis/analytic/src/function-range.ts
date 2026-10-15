// unstable: BigDecimal, the class compute-engine's boxed numbers hold; no /numerics subpath yet
import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@enumeratio/engine/unstable";
import { isRealInt } from "@enumeratio/ce-patches";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";
import { airyBig, airyPrimeBig, besselKYBig } from "./special-big.ts";

// FunctionRange for the oscillating special functions on the reals: AiryAi, AiryBi and BesselY of
// integer order (domain x > 0). Each is a solution of a second-order equation, so its extrema are the
// zeros of the derivative and a conserved-energy quantity bounds every oscillation past a point:
//
//   Airy, y'' = x y, for x < 0:   G = y² + y'²/|x| is non-increasing as x → −∞, and y² ≤ G.
//   Bessel Y_n, u = √x·Y_n, u'' = −q u, q = 1 + (¼ − n²)/x²:
//     n = 0:  E = u'² + q u² is non-increasing, q ≥ 1, so u² ≤ E.
//     n ≥ 1:  W = u² + u'²/q is non-increasing once q > 0, and u² ≤ W.
//
// The range is the extreme values among the derivative's zeros found by a sign scan of a finite
// window, provided the bound beyond the window stays inside them; a window that cannot prove that
// grows a few times, then the call is declined.

const DIGITS = 25;
/** Relative room the tail bound must clear the extremum by, past the rounding of the doubles it is read in. */
const MARGIN = 1e-9;
const MAX_ORDER = 20;

/** A function of the distance `s` from where it starts oscillating (s = −x for Airy, s = x for Bessel). */
interface Curve {
  start: number;
  /** The first window's end; later windows double it. */
  window: number;
  value(s: number): number | undefined;
  slope(s: number): number | undefined;
  /** A bound on |f| for every point at or past `s`, or `undefined` where the argument does not hold. */
  tail(s: number): number | undefined;
  /** Is the function unbounded above / below (so the matching side has no extremum to find)? */
  unbounded: { above: boolean; below: boolean };
}

const real = (x: number): BigDecimal => new BigDecimal(x);
const number = (x: BigDecimal | undefined): number | undefined => (x === undefined ? undefined : x.toNumber());

function airyCurve(kind: "Ai" | "Bi"): Curve {
  const value = (s: number): number | undefined => number(airyBig(kind, real(-s), DIGITS));
  const derivative = (s: number): number | undefined => number(airyPrimeBig(kind, real(-s), DIGITS));
  return {
    start: 0,
    window: 6,
    value,
    // d/ds = −d/dx
    slope: (s) => {
      const d = derivative(s);
      return d === undefined ? undefined : -d;
    },
    tail: (s) => {
      const [f, d] = [value(s), derivative(s)];
      return s <= 0 || f === undefined || d === undefined ? undefined : Math.sqrt(f ** 2 + d ** 2 / s);
    },
    // on x > 0, Ai falls from Ai(0) to 0 and Bi rises from Bi(0) without bound
    unbounded: { above: kind === "Bi", below: false },
  };
}

function besselYCurve(order: number): Curve {
  const y = (n: number, s: number): number | undefined => number(besselKYBig("Y", n, real(s), DIGITS));
  const slope = (s: number): number | undefined => {
    if (order === 0) {
      const y1 = y(1, s);
      return y1 === undefined ? undefined : -y1;
    }
    const [lower, here] = [y(order - 1, s), y(order, s)];
    return lower === undefined || here === undefined ? undefined : lower - (order / s) * here;
  };
  return {
    start: 0.5,
    window: Math.max(20, 2 * order + 10),
    value: (s) => y(order, s),
    slope,
    tail: (s) => {
      const q = 1 + (0.25 - order * order) / (s * s);
      const [f, d] = [y(order, s), slope(s)];
      if (f === undefined || d === undefined) return undefined;
      const [u, du] = [Math.sqrt(s) * f, f / (2 * Math.sqrt(s)) + Math.sqrt(s) * d];
      if (order === 0) return Math.sqrt((du ** 2 + q * u ** 2) / s);
      return q > 0 ? Math.sqrt((u ** 2 + du ** 2 / q) / s) : undefined;
    },
    // Y_n → −∞ at 0 and decays to 0 at ∞
    unbounded: { above: false, below: true },
  };
}

/**
 * The scan's step. A sign scan misses two critical points inside one step; they are simple, and
 * about π/√s apart for Airy (s ≤ 48 across the windows, so ≥ 0.45) and about π or more apart for Y_n.
 */
const STEP = 0.1;
const WINDOWS = 4;

/** Zeros of the slope on [from, to], by a sign scan refined by bisection; `undefined` if the slope cannot be read. */
function criticalPoints(curve: Curve, from: number, to: number): number[] | undefined {
  const points: number[] = [];
  let [a, fa] = [from, curve.slope(from)];
  if (fa === undefined) return undefined;
  if (fa === 0) points.push(from);
  for (let s = from + STEP; a < to; s = Math.min(s + STEP, to)) {
    const fs = curve.slope(s);
    if (fs === undefined) return undefined;
    // an exact zero on the grid is a point of its own; it is then `fa` of the next cell and not counted twice
    if (fs === 0) points.push(s);
    else if (fa * fs < 0) {
      let [lo, hi, flo] = [a, s, fa];
      while (hi - lo > 1e-9) {
        const mid = (lo + hi) / 2;
        const fm = curve.slope(mid);
        if (fm === undefined) return undefined;
        if (flo * fm <= 0) hi = mid;
        else [lo, flo] = [mid, fm];
      }
      points.push((lo + hi) / 2);
    }
    [a, fa] = [s, fs];
  }
  return points;
}

/** The extreme values of `curve`, with the side it is unbounded on left out; `undefined` if they cannot be proved. */
function extremes(curve: Curve): { min?: number; max?: number } | undefined {
  // Y_n rises from −∞ at the start: the first critical point is a maximum, none lies before it
  if (curve.unbounded.below && !((curve.slope(curve.start) ?? 0) > 0)) return undefined;
  for (let k = 0, end = curve.window; k < WINDOWS; k++, end *= 2) {
    const critical = criticalPoints(curve, curve.start, end);
    if (critical === undefined) return undefined;
    const values = [curve.start, ...critical, end].map((s) => curve.value(s));
    if (values.some((v) => v === undefined)) return undefined;
    const [min, max] = [Math.min(...(values as number[])), Math.max(...(values as number[]))];
    const tail = curve.tail(end);
    if (tail === undefined) return undefined;
    const slack = (e: number): number => MARGIN * Math.max(1, Math.abs(e));
    const lowerHolds = curve.unbounded.below || -tail >= min + slack(min);
    const upperHolds = curve.unbounded.above || tail <= max - slack(max);
    if (lowerHolds && upperHolds) {
      return { ...(curve.unbounded.below ? {} : { min }), ...(curve.unbounded.above ? {} : { max }) };
    }
  }
  return undefined;
}

/** `FunctionRange(f, x, y)` for the special functions above, as a numeric condition in `y`. */
export function specialFunctionRange(
  ce: ComputeEngine,
  f: BoxedExpression,
  x: string,
  y: string,
): BoxedExpression | undefined {
  const args = operandsOf(f);
  const ofX = (e: BoxedExpression | undefined): boolean => e !== undefined && symbolNameOf(e) === x;
  let curve: Curve | undefined;
  if ((f.operator === "AiryAi" || f.operator === "AiryBi") && args.length === 1 && ofX(args[0])) {
    curve = airyCurve(f.operator === "AiryAi" ? "Ai" : "Bi");
  } else if (f.operator === "BesselY" && args.length === 2 && ofX(args[1])) {
    const n = args[0]!;
    if (isRealInt(n) && n.re >= 0 && n.re <= MAX_ORDER) curve = besselYCurve(n.re);
  }
  const found = curve === undefined ? undefined : extremes(curve);
  if (found === undefined) return undefined;
  const { min, max } = found;
  if (min !== undefined && max !== undefined) return ce.function("LessEqual", [ce.number(min), y, ce.number(max)]);
  if (max !== undefined) return ce.function("LessEqual", [y, ce.number(max)]);
  return min === undefined ? undefined : ce.function("LessEqual", [ce.number(min), y]);
}
