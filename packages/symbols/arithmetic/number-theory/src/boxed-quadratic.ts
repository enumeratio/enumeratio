// Quadratic integers as expressions. An element is written `QuadraticInteger(d, x, y)` — the
// carrier, x + yω in ℚ(√d)'s ring of integers — or as the number itself, `x + y·Sqrt(d)`
// (halves allowed when d ≡ 1 mod 4). Results come back as the number.

import { bigIntegerAt, type Engine, type Expr, operandsOf } from "@enumeratio/engine";
import { type QuadraticElement, type QuadraticRing, quadraticRing } from "./quadratic.ts";

/** p/q with q > 0. */
type Rational = readonly [p: bigint, q: bigint];
/** a + b·√rad. */
type Surd = readonly [a: Rational, b: Rational];

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const gcd = (a: bigint, b: bigint): bigint => {
  let [x, y] = [abs(a), abs(b)];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
};
const rational = (p: bigint, q = 1n): Rational => {
  if (q < 0n) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1n;
  return [p / g, q / g];
};
const plus = (x: Rational, y: Rational): Rational => rational(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const times = (x: Rational, y: Rational): Rational => rational(x[0] * y[0], x[1] * y[1]);
const ZERO: Rational = [0n, 1n];

const integerOf = (part: unknown): bigint | undefined => {
  if (typeof part === "number") return Number.isSafeInteger(part) ? BigInt(part) : undefined;
  const num = (part as { num?: unknown } | undefined)?.num;
  return typeof num === "string" && /^-?\d+$/.test(num) ? BigInt(num) : undefined;
};

/** k with n = k²·rad, when there is one. */
function rootOver(n: bigint, rad: bigint): bigint | undefined {
  if (n === 0n) return 0n;
  if (n % rad !== 0n || n / rad < 0n) return undefined;
  const q = n / rad;
  let k = BigInt(Math.round(Math.sqrt(Number(q))));
  while (k * k > q) k--;
  while ((k + 1n) * (k + 1n) <= q) k++;
  return k * k === q ? k : undefined;
}

/**
 * The MathJSON as a + b√rad with rational a, b, or undefined. `rad` is d, or |d| inside the
 * imaginary part of a `Complex`, where i·√|d| becomes √d.
 */
function surdOf(json: unknown, rad: bigint, d: bigint): Surd | undefined {
  const n = integerOf(json);
  if (n !== undefined) return [rational(n), ZERO];
  if (json === "ImaginaryUnit") return rad === -1n ? [ZERO, rational(1n)] : undefined;
  if (!Array.isArray(json)) return undefined;
  const [head, ...args] = json as [unknown, ...unknown[]];
  const parts = (): Surd[] | undefined => {
    const out = args.map((a) => surdOf(a, rad, d));
    return out.some((s) => s === undefined) ? undefined : (out as Surd[]);
  };
  switch (head) {
    case "Rational": {
      const [p, q] = [integerOf(args[0]), integerOf(args[1])];
      return p === undefined || q === undefined || q === 0n ? undefined : [rational(p, q), ZERO];
    }
    case "Sqrt": {
      const m = integerOf(args[0]);
      if (m === undefined) return undefined;
      const k = rootOver(m, rad);
      if (k !== undefined) return [ZERO, rational(k)];
      const r = rootOver(m, 1n);
      return r === undefined ? undefined : [rational(r), ZERO];
    }
    case "Negate": {
      const s = surdOf(args[0], rad, d);
      return s && [times(s[0], [-1n, 1n]), times(s[1], [-1n, 1n])];
    }
    case "Add":
    case "Subtract": {
      const ss = parts();
      if (!ss) return undefined;
      return ss.reduce((acc, s, k) => {
        const sign: Rational = head === "Subtract" && k > 0 ? [-1n, 1n] : [1n, 1n];
        return [plus(acc[0], times(sign, s[0])), plus(acc[1], times(sign, s[1]))];
      });
    }
    case "Multiply": {
      const ss = parts();
      if (!ss) return undefined;
      const r: Rational = [rad, 1n];
      return ss.reduce((x, y) => [
        plus(times(x[0], y[0]), times(r, times(x[1], y[1]))),
        plus(times(x[0], y[1]), times(x[1], y[0])),
      ]);
    }
    case "Divide": {
      const [x, y] = [surdOf(args[0], rad, d), surdOf(args[1], rad, d)];
      if (!x || !y || y[1][0] !== 0n || y[0][0] === 0n) return undefined;
      const inverse: Rational = rational(y[0][1], y[0][0]);
      return [times(x[0], inverse), times(x[1], inverse)];
    }
    case "Complex": {
      if (d > 0n) return undefined;
      const re = surdOf(args[0], d, d);
      const im = surdOf(args[1], -d, d);
      if (!re || !im) return undefined;
      // i·(a + b√|d|) = a·i + b·√d, and i is √d only when d = −1.
      if (im[0][0] !== 0n && d !== -1n) return undefined;
      return [re[0], plus(plus(re[1], im[1]), d === -1n ? im[0] : ZERO)];
    }
  }
  return undefined;
}

/** a + b√d as x + yω, when that is in O_K. */
function toElement(R: QuadraticRing, [a, b]: Surd): QuadraticElement | undefined {
  if (R.s === 0n) return a[1] === 1n && b[1] === 1n ? [a[0], b[0]] : undefined;
  // √d = 2ω − s: a + b√d = (a − sb) + 2b·ω.
  const x = plus(a, times(b, [-R.s, 1n]));
  const y = times(b, [2n, 1n]);
  return x[1] === 1n && y[1] === 1n ? [x[0], y[0]] : undefined;
}

/** A `QuadraticInteger(d, x, y)` carrier's ring and element. */
export function quadraticCarrierAt(expr: Expr | undefined): [QuadraticRing, QuadraticElement] | undefined {
  if (expr?.operator !== "QuadraticInteger") return undefined;
  // QuadraticInteger(d, x, y), or the carrier's packed QuadraticInteger((d, x, y)).
  const ops = operandsOf(expr);
  const slots = ops.length === 1 && ops[0]!.operator === "Tuple" ? operandsOf(ops[0]!) : ops;
  const [d, x, y] = slots.map(bigIntegerAt);
  if (d === undefined || x === undefined || y === undefined) return undefined;
  const R = quadraticRing(d);
  return R === undefined ? undefined : [R, [x, y]];
}

/**
 * An element of O_K in an order's coordinates: the order of conductor f is generated by f·ω_K,
 * so x + yω_K is in it exactly when f divides y, as x + (y/f)·ω_f. Undefined when it isn't.
 */
export function intoOrder(R: QuadraticRing, [x, y]: QuadraticElement): QuadraticElement | undefined {
  return y % R.conductor === 0n ? [x, y / R.conductor] : undefined;
}

/** An order's element in O_K's coordinates. */
export const fromOrder = (R: QuadraticRing, [x, y]: QuadraticElement): QuadraticElement => [x, y * R.conductor];

/** The element of R an expression denotes — carrier, integer or surd — or undefined, outside R included. */
export function quadraticAt(R: QuadraticRing, expr: Expr | undefined): QuadraticElement | undefined {
  if (expr === undefined) return undefined;
  const K = quadraticRing(R.d)!;
  const carried = quadraticCarrierAt(expr);
  if (carried !== undefined) return carried[0].d === R.d ? intoOrder(R, carried[1]) : undefined;
  if (expr.operator === "GaussianInteger" && R.d === -1n) {
    const [x, y] = operandsOf(expr).map(bigIntegerAt);
    return x === undefined || y === undefined ? undefined : intoOrder(R, [x, y]);
  }
  const surd = surdOf(expr.json, R.d, R.d);
  const a = surd === undefined ? undefined : toElement(K, surd);
  return a === undefined ? undefined : intoOrder(R, a);
}

const literal = (n: bigint): number | { num: string } =>
  n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : { num: n.toString() };

const rationalJson = (p: bigint, q: bigint): unknown => (q === 1n ? literal(p) : ["Rational", literal(p), literal(q)]);

/** x + yω as the number it is: x' + y'·Sqrt(d), halves where ω = (−1 + √d)/2 needs them. */
export function quadraticExpression(ce: Engine, R: QuadraticRing, element: QuadraticElement): Expr {
  // An order's element, in O_K's coordinates, written over √d as any element of K is.
  const K = quadraticRing(R.d)!;
  const [x, y] = fromOrder(R, element);
  const [a, b] = K.s === 0n ? [rational(x), rational(y)] : [rational(2n * x + K.s * y, 2n), rational(y, 2n)];
  const terms: unknown[] = [];
  if (a[0] !== 0n) terms.push(rationalJson(a[0], a[1]));
  if (b[0] !== 0n) {
    const root = ["Sqrt", literal(R.d)];
    terms.push(b[0] === 1n && b[1] === 1n ? root : ["Multiply", rationalJson(b[0], b[1]), root]);
  }
  const json = terms.length === 0 ? 0 : terms.length === 1 ? terms[0] : ["Add", ...terms];
  return ce.box(json as never);
}
