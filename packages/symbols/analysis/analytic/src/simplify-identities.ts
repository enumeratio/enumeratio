import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { hyperbolicPythagoras } from "./full-simplify.ts";
import { declareCompile } from "@enumeratio/engine";

// Simplify's missing identities, where Wolfram's Simplify has them: a quotient of the
// sine and cosine of the same argument is its tangent (cotangent, and the hyperbolic
// pair likewise), and cosh² − sinh² = 1. Applied after compute-engine's own pass.

const QUOTIENTS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  Sin: { Cos: "Tan" },
  Cos: { Sin: "Cot" },
  Sinh: { Cosh: "Tanh" },
  Cosh: { Sinh: "Coth" },
};

/** `json` with every f(u)/g(u) in QUOTIENTS replaced by its single function, bottom-up. */
function quotients(json: unknown): unknown {
  if (!Array.isArray(json)) return json;
  const [head, ...rest] = json as [string, ...unknown[]];
  const children = rest.map(quotients);
  if (head === "Divide" && children.length === 2) {
    const [num, den] = children;
    if (Array.isArray(num) && Array.isArray(den) && num.length === 2 && den.length === 2) {
      const to = QUOTIENTS[num[0] as string]?.[den[0] as string];
      if (to !== undefined && JSON.stringify(num[1]) === JSON.stringify(den[1])) return [to, num[1]];
    }
  }
  return [head, ...children];
}

// An expression of rationals and GoldenRatio, combined by + − × ÷ and integer powers, is a + bφ
// (φ² = φ + 1, so 1/φ = φ − 1): Simplify folds one that is rational, as 1 + 1/φ − φ = 0.

type Q = readonly [bigint, bigint];
/** a + bφ */
type Phi = readonly [Q, Q];

const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const q = (n: bigint, d = 1n): Q => {
  const g = gcd(n, d) * (d < 0n ? -1n : 1n);
  return [n / g, d / g];
};
const qAdd = ([a, b]: Q, [c, d]: Q): Q => q(a * d + c * b, b * d);
const qMul = ([a, b]: Q, [c, d]: Q): Q => q(a * c, b * d);
const qDiv = (x: Q, [c, d]: Q): Q => qMul(x, q(d, c));
const ZERO = q(0n);
const phiMul = ([a, b]: Phi, [c, d]: Phi): Phi => {
  const bd = qMul(b, d);
  return [qAdd(qMul(a, c), bd), qAdd(qAdd(qMul(a, d), qMul(b, c)), bd)];
};
const phiInverse = ([a, b]: Phi): Phi | undefined => {
  // 1/(a + bφ) = (a + b(1 − φ)) / (a² + ab − b²), the conjugate over the norm
  const norm = qAdd(qAdd(qMul(a, a), qMul(a, b)), qMul(qMul(b, b), q(-1n)));
  if (norm[0] === 0n) return undefined;
  return [qDiv(qAdd(a, b), norm), qDiv(qMul(b, q(-1n)), norm)];
};
const phiPow = (x: Phi, n: number): Phi | undefined => {
  // 0^0 is Indeterminate (Wolfram), not 1
  if (n === 0 && x[0][0] === 0n && x[1][0] === 0n) return undefined;
  let base = n < 0 ? phiInverse(x) : x;
  if (base === undefined) return undefined;
  let result: Phi = [q(1n), ZERO];
  for (let e = Math.abs(n); e > 0; e >>= 1) {
    if (e & 1) result = phiMul(result, base);
    base = phiMul(base, base);
  }
  return result;
};

/** `json` as a + bφ, or undefined if it is anything else. */
function asPhi(json: unknown): Phi | undefined {
  if (typeof json === "number") return Number.isInteger(json) ? [q(BigInt(json)), ZERO] : undefined;
  if (json === "GoldenRatio") return [ZERO, q(1n)];
  if (!Array.isArray(json)) return undefined;
  const [head, ...rest] = json as [string, ...unknown[]];
  if (head === "Rational" && rest.length === 2 && rest.every((x) => Number.isInteger(x) && x !== 0)) {
    return [q(BigInt(rest[0] as number), BigInt(rest[1] as number)), ZERO];
  }
  if (head === "Power" && rest.length === 2 && Number.isInteger(rest[1]) && Math.abs(rest[1] as number) <= 64) {
    const base = asPhi(rest[0]);
    return base === undefined ? undefined : phiPow(base, rest[1] as number);
  }
  const parts = rest.map(asPhi);
  if (parts.some((p) => p === undefined) || parts.length === 0) return undefined;
  const xs = parts as Phi[];
  switch (head) {
    case "Add":
      return xs.reduce((a, b) => [qAdd(a[0], b[0]), qAdd(a[1], b[1])]);
    case "Subtract":
      return xs.length === 2
        ? [qAdd(xs[0]![0], qMul(xs[1]![0], q(-1n))), qAdd(xs[0]![1], qMul(xs[1]![1], q(-1n)))]
        : undefined;
    case "Negate":
      return xs.length === 1 ? [qMul(xs[0]![0], q(-1n)), qMul(xs[0]![1], q(-1n))] : undefined;
    case "Multiply":
      return xs.reduce(phiMul);
    case "Divide": {
      const inverse = xs.length === 2 ? phiInverse(xs[1]!) : undefined;
      return inverse === undefined ? undefined : phiMul(xs[0]!, inverse);
    }
    default:
      return undefined;
  }
}

/** The rational `json` equals, when it is built from GoldenRatio and collapses to one. */
export function goldenRatioCollapse(json: unknown): unknown {
  if (!JSON.stringify(json).includes('"GoldenRatio"')) return json;
  const phi = asPhi(json);
  if (phi === undefined || phi[1][0] !== 0n) return json;
  const [n, d] = phi[0];
  // a part past a double's exact integers would be written rounded: leave the input
  if (!Number.isSafeInteger(Number(n)) || !Number.isSafeInteger(Number(d))) return json;
  return d === 1n ? Number(n) : ["Rational", Number(n), Number(d)];
}

type Evaluate = (ops: ReadonlyArray<BoxedExpression>, options: never) => BoxedExpression | undefined;

// Attached directly rather than through `wrapOperator`: Simplify is lazy, and the wrapper
// would evaluate its argument in full before every call.
export function declareSimplifyIdentities(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("Simplify");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  const native = operator?.evaluate as Evaluate | undefined;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = ((ops: ReadonlyArray<BoxedExpression>, options: never) => {
    const simplified = native(ops, options);
    if (simplified === undefined || ops.length !== 1) return simplified;
    const json = simplified.json;
    const folded = goldenRatioCollapse(quotients(json));
    const rewritten = JSON.stringify(folded) === JSON.stringify(json) ? simplified : ce.box(folded as never).evaluate();
    return hyperbolicPythagoras(rewritten, ce);
  }) as typeof operator.evaluate;
  // compile builtin: identities: simplification keeps the value
  declareCompile(ce, "Simplify", "builtin");
}
