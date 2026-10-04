import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { wrapOperator } from "@enumeratio/engine";

// --- Arcsin/Arccos/Arctan at the radicals of the tenths of π ------------------------------
// The native tables recognise some spellings (Arccos((1 + √5)/4) = π/5) and miss others:
// Arcsin(√2/4·√(5 − √5)) = π/5 and Arctan(√(1 − 2/√5)) = π/10 stay unevaluated. An argument
// that is a radical (rationals and roots, nothing else) and matches sin, cos or tan of a
// multiple of π/10 to RADICAL_MATCH_DIGITS is that angle: the radicals here have degree at
// most 4 and small coefficients, so two distinct ones differ far above RADICAL_MATCH_GAP.

const RADICAL_MATCH_DIGITS = 50;
const RADICAL_MATCH_GAP = new BigDecimal("1e-40");

const RADICAL_HEADS = new Set(["Add", "Subtract", "Multiply", "Negate", "Divide", "Sqrt", "Root"]);

/** An exact real built from rationals by arithmetic and roots: no symbol, no float. */
function isRadical(json: unknown): boolean {
  if (typeof json === "number") return Number.isInteger(json);
  if (!Array.isArray(json)) return false;
  const [head, ...args] = json as [unknown, ...unknown[]];
  if (head === "Rational") return args.every((a) => typeof a === "number" && Number.isInteger(a));
  if (head === "Power") return isRadical(args[0]) && (Number.isInteger(args[1]) || isRationalLiteral(args[1]));
  return typeof head === "string" && RADICAL_HEADS.has(head) && args.every(isRadical);
}
const isRationalLiteral = (json: unknown): boolean =>
  Array.isArray(json) && json[0] === "Rational" && json.length === 3;

/** `x` at RADICAL_MATCH_DIGITS, as a decimal, or undefined when it isn't a real number. */
function decimalAt(ce: ComputeEngine, x: BoxedExpression): BigDecimal | undefined {
  const precision = ce.precision;
  try {
    ce.precision = Math.max(precision, RADICAL_MATCH_DIGITS);
    const json = x.N().json;
    const text = typeof json === "number" ? String(json) : (json as { num?: unknown }).num;
    return typeof text === "string" && /^-?[0-9.]+(e[-+]?[0-9]+)?$/.test(text) ? new BigDecimal(text) : undefined;
  } finally {
    ce.precision = precision;
  }
}

/** Each inverse's principal range, in tenths of π, and the function it inverts. */
const TENTHS: Record<"Arcsin" | "Arccos" | "Arctan", { forward: string; from: number; to: number }> = {
  Arcsin: { forward: "Sin", from: -5, to: 5 },
  Arccos: { forward: "Cos", from: 0, to: 10 },
  Arctan: { forward: "Tan", from: -4, to: 4 },
};

export function evaluateInverseTrigAtRadicals(ce: ComputeEngine): void {
  for (const [head, { forward, from, to }] of Object.entries(TENTHS)) {
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0] !== undefined && isRadical(ops[0].json),
      (native) => (ops, options) => {
        const answer = native?.(ops, options);
        if (answer !== undefined && answer.operator !== head) return answer;
        const x = decimalAt(ce, ops[0]!);
        if (x === undefined) return answer;
        for (let k = from; k <= to; k++) {
          const angle = ce.box(["Multiply", ["Rational", k, 10], "Pi"]);
          const value = decimalAt(ce, ce.box([forward, angle.json]));
          if (value !== undefined && value.sub(x).abs().lt(RADICAL_MATCH_GAP))
            return options.numericApproximation ? angle.N() : angle.evaluate();
        }
        return answer;
      },
      1,
    );
  }
}

// --- Arcosh/Arcoth at 0 ------------------------------------------------------------------
// Both stay unevaluated at an exact 0, though their principal values there are exact:
// arcosh(0) = ln(0 + √(0 − 1)) = ln(i) = iπ/2 and arcoth(0) = ½ ln((0 + 1)/(0 − 1)) =
// ½ ln(−1) = iπ/2, on the principal branches (DLMF §4.37), as Wolfram answers. A float 0
// is left to the native numeric kernel, which already gives 1.5707963267948966i.
export function evaluateInverseHyperbolicAtZero(ce: ComputeEngine): void {
  for (const head of ["Arcosh", "Arcoth"] as const) {
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0]?.json === 0,
      () => (_ops, options) => {
        const value = ce.box(["Multiply", ["Rational", 1, 2], "ImaginaryUnit", "Pi"]);
        return options.numericApproximation ? value.N() : value.evaluate();
      },
      1,
    );
  }
}
