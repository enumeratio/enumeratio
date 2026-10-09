import { asDouble, hasFloatOperand, isFiniteNum, wantsNumber } from "@enumeratio/ce-patches";
import { type Engine, wrapOperator } from "@enumeratio/engine";

// sinh(x + iy) = sinh x cos y + i cosh x sin y, cosh(x + iy) = cosh x cos y + i sinh x sin y.
// At y = kπ/2 one of cos y, sin y is exactly 0, so the value has an exactly real or exactly
// imaginary part; the double y = fl(kπ/2) is off by an ulp and the generic route turns that
// into a ~1e-17 stray part (Csch(1/2 + iπ/2)² came out with a −4.5e-17 i). Within
// `SNAP_ULPS` of kπ/2 the table is exact instead.

/** Distance from kπ/2, in ulps of y, inside which y is taken to be kπ/2. */
const SNAP_ULPS = 4;
const HALF_PI = Math.PI / 2;

/** The k with |y − kπ/2| within `SNAP_ULPS` ulps of y, or undefined. */
function halfPiMultiple(y: number): number | undefined {
  const k = Math.round(y / HALF_PI);
  return k !== 0 && Math.abs(y - k * HALF_PI) <= SNAP_ULPS * Number.EPSILON * Math.abs(y) ? k : undefined;
}

const HYPERBOLIC = ["Sinh", "Cosh", "Tanh", "Coth", "Sech", "Csch"] as const;
type Hyperbolic = (typeof HYPERBOLIC)[number];

type C = readonly [re: number, im: number];

/** The head at x + ikπ/2 for even k (cos = ±1, sin = 0): the value stays on the real axis. */
const EVEN: Record<Hyperbolic, (x: number, cos: number) => C> = {
  Sinh: (x, cos) => [Math.sinh(x) * cos, 0],
  Cosh: (x, cos) => [Math.cosh(x) * cos, 0],
  Tanh: (x) => [Math.tanh(x), 0],
  Coth: (x) => [1 / Math.tanh(x), 0],
  Sech: (x, cos) => [cos / Math.cosh(x), 0],
  Csch: (x, cos) => [cos / Math.sinh(x), 0],
};

/** The same for odd k (cos = 0, sin = ±1): sinh and cosh swap roles and the value turns imaginary. */
const ODD: Record<Hyperbolic, (x: number, sin: number) => C> = {
  Sinh: (x, sin) => [0, Math.cosh(x) * sin],
  Cosh: (x, sin) => [0, Math.sinh(x) * sin],
  Tanh: (x) => [1 / Math.tanh(x), 0],
  Coth: (x) => [Math.tanh(x), 0],
  Sech: (x, sin) => [0, -sin / Math.sinh(x)],
  Csch: (x, sin) => [0, -sin / Math.cosh(x)],
};

/** The head at x + ikπ/2, one real function of x per case (no complex division, so no extra
 * rounding). Undefined at a pole. */
function evaluate(head: Hyperbolic, x: number, k: number): C | undefined {
  const quarter = ((k % 4) + 4) % 4;
  const value = quarter % 2 === 0 ? EVEN[head](x, 1 - quarter) : ODD[head](x, 2 - quarter);
  return Number.isFinite(value[0]) && Number.isFinite(value[1]) ? value : undefined;
}

export function declareHyperbolicHalfPeriod(ce: Engine): void {
  for (const head of HYPERBOLIC) {
    // compile builtin: snaps a complex argument within ulps of x + i*k*pi/2: same value up to a stray 1e-17 part
    wrapOperator(
      ce,
      [head, 1],
      (ops) => isFiniteNum(ops[0]) && ops[0].im !== 0 && halfPiMultiple(ops[0].im) !== undefined,
      () => (ops, options) => {
        if (!wantsNumber(ops, options) && !hasFloatOperand(ops)) return undefined;
        const z = ops[0];
        const r = evaluate(head, z.re, halfPiMultiple(z.im)!);
        if (r === undefined) return undefined;
        const [re, im] = r;
        return im === 0 ? ce.number(re) : asDouble(ce, ce.number(ce.complex(re, im)));
      },
      { arity: 1, compile: "builtin" },
    );
  }
}
