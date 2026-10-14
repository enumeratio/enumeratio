import {
  bigIntegerAt,
  bigRationalAt,
  type Engine,
  type Expr,
  operandsOf,
  symbolNameOf,
  wrapOperator,
} from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// Exact values Wolfram folds on sight and compute-engine leaves as calls: the Airy functions
// at 0, and the two Gauss reductions that drop a hypergeometric's parameters. Plus the pieces
// `FunctionExpand` uses: K and E at the lemniscatic parameters, K′, and the Airy rotation laws.
// Each wrapper is a pre-check in front of the native kernel, which still answers everything else.

const finish = (expr: Expr, options: EvalOptions): Expr => (options.numericApproximation ? expr.N() : expr.evaluate());

/** The exact integer `n` at an operand (a float `0.0` is not one: it keeps a float answer). */
const isInteger = (op: Expr | undefined, n: bigint): boolean => bigIntegerAt(op) === n;

/** Ai(0), Ai′(0), Bi(0), Bi′(0) (DLMF 9.2.3-4), as Wolfram writes them. */
const AIRY_AT_ZERO: Readonly<Record<string, unknown>> = {
  AiryAi: ["Divide", 1, ["Multiply", ["Power", 3, ["Rational", 2, 3]], ["Gamma", ["Rational", 2, 3]]]],
  AiryAiPrime: ["Negate", ["Divide", 1, ["Multiply", ["Power", 3, ["Rational", 1, 3]], ["Gamma", ["Rational", 1, 3]]]]],
  AiryBi: ["Divide", 1, ["Multiply", ["Power", 3, ["Rational", 1, 6]], ["Gamma", ["Rational", 2, 3]]]],
  AiryBiPrime: ["Divide", ["Power", 3, ["Rational", 1, 6]], ["Gamma", ["Rational", 1, 3]]],
};

// 2F1(a, b; b; z) = (1−z)^(−a) and 1F1(a; a; z) = e^z: the lower parameter cancels an upper one.
const sameParameter = (x: Expr | undefined, y: Expr | undefined): boolean =>
  x !== undefined && y !== undefined && x.isSame(y);

/** The closed form of `Hypergeometric2F1(a, b, c, z)` once `c` equals `a` or `b`, else undefined. */
const reduce2F1 = (ce: Engine, ops: readonly Expr[]): Expr | undefined => {
  const [a, b, c, z] = ops;
  const survivor = sameParameter(b, c) ? a : sameParameter(a, c) ? b : undefined;
  if (survivor === undefined || z === undefined) return undefined;
  return ce.function("Power", [ce.function("Subtract", [ce.One, z]), ce.function("Negate", [survivor])]);
};

export function declareSpecialValues(ce: Engine): void {
  for (const [head, value] of Object.entries(AIRY_AT_ZERO)) {
    // compile builtin: the closed form at an exact 0; every other operand reaches the numeric kernel
    wrapOperator(
      ce,
      [head, 0],
      (ops) => isInteger(ops[0], 0n),
      () => (_ops, options) => finish(ce.box(value as never), options),
      { arity: 1, compile: "builtin" },
    );
  }

  // compile builtin: the reduction at matching exact parameters; the numeric kernel answers the rest
  wrapOperator(
    ce,
    ["Hypergeometric1F1", 1, 1, 1],
    (ops) => sameParameter(ops[0], ops[1]),
    () => (ops, options) => finish(ce.function("Exp", [ops[2]!]), options),
    { arity: 3, compile: "builtin" },
  );
  // compile builtin: the reduction at matching exact parameters; the numeric kernel answers the rest
  wrapOperator(
    ce,
    ["Hypergeometric2F1", 1, 1, 1, 1],
    (ops) => reduce2F1(ce, ops) !== undefined,
    () => (ops, options) => finish(reduce2F1(ce, ops)!, options),
    { arity: 4, compile: "builtin" },
  );
}

// --- FunctionExpand ------------------------------------------------------------------

/** Γ(¼)², the constant every lemniscatic value below is written in. */
const GAMMA_QUARTER_SQUARED: unknown = ["Power", ["Gamma", ["Rational", 1, 4]], 2];

/** K(m) and E(m) at m = −1 and m = ½ (the lemniscatic and the singular-value parameters), by Γ(¼). */
const COMPLETE_ELLIPTIC: Readonly<Record<string, Readonly<Record<"K" | "E", unknown>>>> = {
  "-1/1": {
    K: ["Divide", GAMMA_QUARTER_SQUARED, ["Multiply", 4, ["Sqrt", ["Multiply", 2, "Pi"]]]],
    E: [
      "Add",
      ["Divide", ["Multiply", ["Sqrt", 2], ["Power", "Pi", ["Rational", 3, 2]]], GAMMA_QUARTER_SQUARED],
      ["Divide", GAMMA_QUARTER_SQUARED, ["Multiply", 4, ["Sqrt", ["Multiply", 2, "Pi"]]]],
    ],
  },
  "1/2": {
    K: ["Divide", GAMMA_QUARTER_SQUARED, ["Multiply", 4, ["Sqrt", "Pi"]]],
    E: [
      "Add",
      ["Divide", ["Power", "Pi", ["Rational", 3, 2]], GAMMA_QUARTER_SQUARED],
      ["Divide", GAMMA_QUARTER_SQUARED, ["Multiply", 8, ["Sqrt", "Pi"]]],
    ],
  },
};

/** `EllipticK(m)` / `EllipticE(m)` in Γ(¼) at m = −1 or ½, else undefined. */
export function expandCompleteElliptic(ce: Engine, head: string, ops: readonly Expr[]): Expr | undefined {
  if (ops.length !== 1 || (head !== "EllipticK" && head !== "EllipticE")) return undefined;
  const m = bigRationalAt(ops[0]);
  const form = m === undefined ? undefined : COMPLETE_ELLIPTIC[`${m[0]}/${m[1]}`];
  return form === undefined ? undefined : ce.box(form[head === "EllipticK" ? "K" : "E"] as never);
}

/** K′(m) = (E(m) − (1−m)K(m)) / (2m(1−m)) for `Apply(Derivative(EllipticK, 1), m)`, else undefined. */
export function expandEllipticKPrime(ce: Engine, e: Expr): Expr | undefined {
  const [derivative, m] = operandsOf(e);
  if (e.operator !== "Apply" || derivative?.operator !== "Derivative" || m === undefined) return undefined;
  const [head, order] = operandsOf(derivative);
  if (head === undefined || symbolNameOf(head) !== "EllipticK" || !isInteger(order, 1n)) return undefined;
  const k = ce.function("EllipticK", [m]);
  const oneMinusM = ce.function("Subtract", [ce.One, m]);
  return ce.function("Divide", [
    ce.function("Subtract", [ce.function("EllipticE", [m]), ce.function("Multiply", [oneMinusM, k])]),
    ce.function("Multiply", [ce.number(2), m, oneMinusM]),
  ]);
}

/** A real `c` is e^(2πi/3)'s (`+1`) or its conjugate's (`-1`), within rounding; else undefined. */
const cubeRootOfUnity = (c: Expr): 1 | -1 | undefined => {
  const value = c.N();
  if (Math.abs(value.re + 0.5) > 1e-12 || Math.abs(Math.abs(value.im) - Math.sqrt(3) / 2) > 1e-12) return undefined;
  return value.im > 0 ? 1 : -1;
};

/**
 * Ai(ωz) and Bi(ωz) with ω = e^(±2πi/3) (DLMF 9.2.11-12), the rotation Wolfram's FunctionExpand
 * applies, for an argument `z·ω` whose ω is the one constant factor; else undefined.
 */
export function expandAiryRotation(ce: Engine, head: string, arg: Expr): Expr | undefined {
  if ((head !== "AiryAi" && head !== "AiryBi") || arg.operator !== "Multiply") return undefined;
  const factors = operandsOf(arg);
  const at = factors.findIndex((f) => f.symbols.length === 0 && cubeRootOfUnity(f) !== undefined);
  if (at < 0) return undefined;
  const sign = cubeRootOfUnity(factors[at]!)!;
  const rest = factors.filter((_, i) => i !== at);
  const z = rest.length === 1 ? rest[0]! : ce.function("Multiply", rest);
  const [ai, bi] = [ce.function("AiryAi", [z]), ce.function("AiryBi", [z])];
  const i = ce.symbol("ImaginaryUnit");
  const mul = (...xs: Expr[]) => ce.function("Multiply", xs);
  const add = (...xs: Expr[]) => ce.function("Add", xs);
  const s3 = ce.function("Sqrt", [ce.number(3)]);
  // ω = e^(2πi/3) (`sign` = 1) and its conjugate: the sign of every imaginary unit flips.
  const j = sign === 1 ? i : ce.function("Negate", [i]);
  const neg = (x: Expr) => ce.function("Negate", [x]);
  const four = ce.number(4);
  // Bi(ωz) = (√3 − i)(3Ai(z) + iBi(z))/4
  if (head === "AiryBi")
    return ce.function("Divide", [mul(add(s3, neg(j)), add(mul(ce.number(3), ai), mul(j, bi))), four]);
  // Ai(ωz) = (1 + i√3)(Ai(z) − iBi(z))/4
  return ce.function("Divide", [mul(add(ce.One, mul(j, s3)), add(ai, neg(mul(j, bi)))), four]);
}
