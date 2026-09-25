import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { Json } from "./bernoulli.ts";
import { type BoxInput, isRealInt } from "./box.ts";

// HarmonicNumber(n) = Σ_{k=1}^n 1/k and HarmonicNumber(n, r) = Σ_{k=1}^n k^{-r} — exact
// rationals for a non-negative integer n (r any integer, either arity). Off the integer
// lattice — a non-integer or complex first argument, or a non-integer order — Wolfram's
// convention is the analytic continuation: HarmonicNumber(z) = ψ(z+1) + γ and
// HarmonicNumber(z, r) = ζ(r) − ζ(r, z+1). Both continuations reduce to the same exact
// values at the integers (ψ(n+1) + γ = H_n is the standard digamma identity), so this
// kernel only needs the exact path where it beats double precision.

type Rat = readonly [bigint, bigint]; // [num, den], den > 0, reduced

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

const normalize = ([n, d]: Rat): Rat => {
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return [n / g, d / g];
};

const rAdd = (x: Rat, y: Rat): Rat => normalize([x[0] * y[1] + y[0] * x[1], x[1] * y[1]]);

const intNode = (v: bigint): Json =>
  v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= BigInt(Number.MIN_SAFE_INTEGER)
    ? Number(v)
    : { num: v.toString() };

const ratNode = ([n, d]: Rat): Json =>
  d === 1n ? intNode(n) : ["Rational", intNode(n), intNode(d)];

/** base^e for a bigint base and a non-negative integer exponent e. */
const ipow = (base: bigint, e: number): bigint => {
  let r = 1n;
  for (let i = 0; i < e; i++) r *= base;
  return r;
};

/**
 * Exact generalized harmonic number Σ_{k=1}^n k^{-r}, n ≥ 0 and r an integer of either
 * sign, as a reduced bigint rational. n = 0 is the empty sum, 0.
 */
function harmonicRational(n: number, r: number): Rat {
  let sum: Rat = [0n, 1n];
  for (let k = 1; k <= n; k++) {
    const term: Rat = r >= 0 ? normalize([1n, ipow(BigInt(k), r)]) : [ipow(BigInt(k), -r), 1n];
    sum = rAdd(sum, term);
  }
  return sum;
}

/**
 * Evaluate HarmonicNumber(z) / HarmonicNumber(z, r). Exact rational at a non-negative
 * integer z with an integer (or absent) r; ComplexInfinity at a negative integer z,
 * matching Wolfram (the sum has no value there); the ψ/ζ continuation otherwise, numeric
 * only — plain `evaluate()` leaves a non-integer-order or non-integer-z call symbolic,
 * the same gate the other analytic heads use.
 */
export function evaluateHarmonicNumber(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  numeric: boolean,
): BoxedExpression | undefined {
  const z = ops[0];
  const r = ops[1];
  if (z === undefined) return undefined;
  const box = (expr: Json) => ce.box(expr as unknown as BoxInput);
  const finish = (expr: BoxedExpression) => (numeric ? expr.N() : expr.evaluate());

  if (isRealInt(z) && z.re < 0) return ce.symbol("ComplexInfinity"); // no sum below n = 0

  if (isRealInt(z) && z.re === 0) return finish(box(0)); // empty sum, any r

  if (isRealInt(z) && z.re > 0 && (r === undefined || isRealInt(r))) {
    return finish(box(ratNode(harmonicRational(z.re, r === undefined ? 1 : r.re))));
  }

  // Everything else — non-integer/complex z, or a non-integer order — is the continuation,
  // reached through the native heads it is built from rather than a second numeric kernel.
  if (numeric) {
    const zJson = z.json as unknown as Json;
    if (r === undefined) {
      return finish(box(["Add", ["PolyGamma", 0, ["Add", zJson, 1]], "EulerGamma"]));
    }
    const rJson = r.json as unknown as Json;
    return finish(box(["Subtract", ["Zeta", rJson], ["HurwitzZeta", rJson, ["Add", zJson, 1]]]));
  }

  return undefined; // stay symbolic
}
