import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, operandsOf } from "@enumeratio/boxed";
import type { EvalOptions } from "./box.ts";
import { evaluateExpToTrig } from "./exp-to-trig.ts";

// FullSimplify(expr) — compute-engine's own `simplify()` (the Pythagorean identity and the
// double-angle product already fold there) plus five extra passes, each aimed at one class of
// backlog example:
//  - the Gamma functional equation, `Γ(a)/Γ(b) = ∏(b..a−1)` for a concrete integer `a − b`;
//  - the hyperbolic Pythagorean identity `cosh²(u) − sinh²(u) = 1`, recognized after
//    `simplify()` has already rearranged the difference into an `Add`;
//  - denesting `Sqrt(a + 2·Sqrt(b))` into `Sqrt(x) + Sqrt(y)` for concrete rational `a, b`
//    with a rational discriminant;
//  - a sum of integer multiples of arctangents of rationals that is a multiple of π/4
//    (Machin's formula);
//  - ExpToTrig everywhere in the tree, which is how a `(e^x − e^(−x))/2` shows up as `Sinh(x)`
//    rather than needing its own "recognize a hyperbolic definition" rule.
//
// What this does NOT do: no general special-function identity table (only the one Gamma
// shift above), no general nested-radical denesting (only the depth-one quadratic form above,
// and only with concrete rational `a`/`b`), no trig identities beyond what `simplify()`
// already has. An expression needing anything past this list is left as `simplify()` leaves
// it — never guessed at.

/** Γ(a)/Γ(b) where a − b is a nonzero concrete integer n: the functional equation
 * Γ(x+1) = x·Γ(x), applied |n| times (either direction). */
function gammaRatio(ce: ComputeEngine, e: BoxedExpression): BoxedExpression {
  const ops = operandsOf(e);
  if (e.operator !== "Divide" || ops.length !== 2) return e;
  const [num, den] = ops;
  const numOps = operandsOf(num);
  const denOps = operandsOf(den);
  if (
    num.operator !== "Gamma" ||
    den.operator !== "Gamma" ||
    numOps.length === 0 ||
    denOps.length === 0
  ) {
    return e;
  }
  const a = numOps[0];
  const b = denOps[0];
  const diff = ce.function("Subtract", [a, b]).evaluate();
  if (diff.im !== 0 || !Number.isInteger(diff.re) || diff.re === 0) return e;
  const n = diff.re;
  const terms: BoxedExpression[] = [];
  if (n > 0) {
    for (let k = 0; k < n; k++) terms.push(ce.function("Add", [b, k]).evaluate());
  } else {
    for (let k = 1; k <= -n; k++) {
      terms.push(ce.function("Divide", [1, ce.function("Subtract", [b, k]).evaluate()]).evaluate());
    }
  }
  return ce.function("Multiply", terms).evaluate();
}

/** cosh(u)² − sinh(u)² = 1, recognized once `simplify()` has rearranged the difference into
 * an `Add` of `cosh(u)²` and `−sinh(u)²` for the SAME `u`. */
export function hyperbolicPythagoras(e: BoxedExpression, ce: ComputeEngine): BoxedExpression {
  const ops = operandsOf(e);
  if (e.operator !== "Add" || ops.length !== 2) return e;
  const [x, y] = ops;
  const coshSquared = (t: BoxedExpression): BoxedExpression | undefined => {
    const tOps = operandsOf(t);
    const inner = operandsOf(tOps[0]);
    return t.operator === "Power" &&
      tOps.length === 2 &&
      tOps[0].operator === "Cosh" &&
      tOps[1].isSame(2)
      ? inner[0]
      : undefined;
  };
  const negSinhSquared = (t: BoxedExpression): BoxedExpression | undefined => {
    const tOps = operandsOf(t);
    const inner = t.operator === "Negate" && tOps.length === 1 ? tOps[0] : undefined;
    const innerOps = inner === undefined ? [] : operandsOf(inner);
    const innerInner = innerOps.length > 0 ? operandsOf(innerOps[0]) : [];
    return inner?.operator === "Power" &&
      innerOps.length === 2 &&
      innerOps[0].operator === "Sinh" &&
      innerOps[1].isSame(2)
      ? innerInner[0]
      : undefined;
  };
  for (const [p, q] of [
    [x, y],
    [y, x],
  ] as const) {
    const u1 = coshSquared(p);
    const u2 = negSinhSquared(q);
    if (u1 !== undefined && u2 !== undefined && u1.isSame(u2)) return ce.One;
  }
  return e;
}

/**
 * `Sqrt(a + 2·Sqrt(b))` for concrete rational `a, b` with `a² − 4b` a perfect square:
 * denests to `Sqrt(x) + Sqrt(y)`, the roots of `t² − a·t + b = 0`. Recurses everywhere,
 * bottom-up.
 *
 * Works on the plain MathJSON (`.json`), not `.ops` navigation: compute-engine folds a
 * concrete `Multiply(2, Sqrt(6))` into a single exact numeric value (an internal radical
 * representation, whose `.operator` reads as an atomic `"Real"`) rather than keeping it as a
 * `Multiply` function call. `.json` still serializes it back to `["Multiply", 2, ["Sqrt",
 * 6]]`, which is what this looks for.
 */
function denestSqrtJson(json: unknown): unknown {
  if (!Array.isArray(json)) return json;
  const [head, ...rawChildren] = json as [string, ...unknown[]];
  const children = rawChildren.map(denestSqrtJson);
  const rebuilt = [head, ...children];
  if (head !== "Sqrt") return rebuilt;
  const inner = children[0];
  if (!Array.isArray(inner) || inner[0] !== "Add" || inner.length !== 3) return rebuilt;
  const [t1, t2] = [inner[1], inner[2]];
  const a = typeof t1 === "number" ? t1 : typeof t2 === "number" ? t2 : undefined;
  if (a === undefined) return rebuilt;
  const mul = a === t1 ? t2 : t1;
  if (!Array.isArray(mul) || mul[0] !== "Multiply" || mul.length !== 3) return rebuilt;
  const [c1, c2] = [mul[1], mul[2]];
  const two = c1 === 2 ? c1 : c2 === 2 ? c2 : undefined;
  if (two === undefined) return rebuilt;
  const sqrtB = two === c1 ? c2 : c1;
  if (!Array.isArray(sqrtB) || sqrtB[0] !== "Sqrt" || typeof sqrtB[1] !== "number") return rebuilt;
  const b = sqrtB[1];
  const discSquared = a * a - 4 * b;
  if (discSquared < 0) return rebuilt;
  const disc = Math.sqrt(discSquared);
  if (Math.abs(disc - Math.round(disc)) > 1e-9) return rebuilt;
  const x = (a + disc) / 2;
  const y = (a - disc) / 2;
  if (x < 0 || y < 0) return rebuilt; // real roots only
  return ["Add", ["Sqrt", x], ["Sqrt", y]];
}

/** One term of an arctangent sum: c·arctan(p/q), c an integer. */
interface ArctanTerm {
  readonly c: bigint;
  readonly p: bigint;
  readonly q: bigint;
}

function arctanTerm(t: BoxedExpression): ArctanTerm | undefined {
  let c = 1n;
  let inner = t;
  if (t.operator === "Negate") {
    c = -1n;
    inner = operandsOf(t)[0]!;
  } else if (t.operator === "Multiply" && operandsOf(t).length === 2) {
    const [k, a] = operandsOf(t);
    const n = bigIntegerAt(k);
    if (n === undefined) return undefined;
    c = n;
    inner = a!;
  }
  if (inner.operator !== "Arctan") return undefined;
  const r = bigRationalAt(operandsOf(inner)[0]);
  return r === undefined ? undefined : { c, p: r[0], q: r[1] };
}

/**
 * Σ cᵢ·arctan(rᵢ) over rationals, when it is a multiple of π/4 -- Machin's formula and its
 * kin. The sum is the argument of ∏(qᵢ + i·pᵢ)^cᵢ, an exact Gaussian integer X + iY; the
 * angle is a multiple of π/4 exactly when X = 0, Y = 0 or |X| = |Y|, and the double sum
 * picks which one.
 */
function arctanSum(ce: ComputeEngine, e: BoxedExpression): BoxedExpression {
  if (e.operator !== "Add") return e;
  const terms = operandsOf(e).map(arctanTerm);
  if (terms.length < 2 || terms.some((t) => t === undefined || t.c > 64n || t.c < -64n)) return e;
  let [x, y] = [1n, 0n];
  let angle = 0;
  for (const { c, p, q } of terms as ArctanTerm[]) {
    const [a, b] = c < 0n ? [q, -p] : [q, p]; // a negative power turns by the conjugate
    for (let k = 0n; k < (c < 0n ? -c : c); k++) [x, y] = [x * a - y * b, x * b + y * a];
    angle += Number(c) * Math.atan(Number(p) / Number(q));
  }
  const abs = (n: bigint) => (n < 0n ? -n : n);
  if (x !== 0n && y !== 0n && abs(x) !== abs(y)) return e;
  const m = Math.round(angle / (Math.PI / 4));
  if (Math.abs(angle - (m * Math.PI) / 4) > 1e-9) return e;
  return ce.function("Multiply", [ce.number([m, 4]), ce.Pi]).evaluate();
}

const denestSqrt = (ce: ComputeEngine, e: BoxedExpression): BoxedExpression =>
  ce.box(denestSqrtJson(e.json) as never).evaluate();

export function fullSimplify(ce: ComputeEngine, expr: BoxedExpression): BoxedExpression {
  let e = expr.simplify();
  e = gammaRatio(ce, e).simplify();
  e = hyperbolicPythagoras(e, ce);
  e = arctanSum(ce, e);
  e = denestSqrt(ce, e).simplify();
  e = (evaluateExpToTrig(ce, [e]) ?? e).simplify();
  return e;
}

export function declareFullSimplify(ce: ComputeEngine): void {
  ce.declare("FullSimplify", {
    signature: "(value) -> value",
    evaluate: (ops: readonly BoxedExpression[], _options: EvalOptions) => {
      const expr = ops[0];
      return expr === undefined ? undefined : fullSimplify(ce, expr);
    },
  });
}
