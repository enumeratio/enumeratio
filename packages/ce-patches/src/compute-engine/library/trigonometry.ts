import { BigDecimal, type BoxedExpression, type ComputeEngine } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/engine";

const isPositiveInfinity = (op: BoxedExpression): boolean => op.json === "PositiveInfinity";
const isNegativeInfinity = (op: BoxedExpression): boolean => op.json === "NegativeInfinity";
const isComplexInfinity = (op: BoxedExpression): boolean => op.json === "ComplexInfinity";
const isAnyInfinity = (op: BoxedExpression): boolean =>
  isPositiveInfinity(op) || isNegativeInfinity(op) || isComplexInfinity(op);

const negI = (ce: ComputeEngine) => ce.function("Negate", [ce.symbol("ImaginaryUnit")]);
const directedInfinity = (ce: ComputeEngine, direction: BoxedExpression) =>
  ce.function("DirectedInfinity", [direction]).evaluate();
const indeterminate = (ce: ComputeEngine) => ce.symbol("Indeterminate");

// --- Arcsin/Arccos at the infinities (DLMF 4.23.7-4.23.9 asymptotics) --------------------
// arcsin(z) = -i*ln(iz + sqrt(1-z^2)) ~ pi/2 - i*ln(2z) as z -> +Infinity along the reals:
// the finite real part (+-pi/2) drops out of a DirectedInfinity, leaving direction -i.
// arcsin(-x) = -arcsin(x) (odd), so -Infinity takes the opposite direction. Both errors
// stem from the same boxing gap: Arcsin/Arccos's declared signature is plain `complex`,
// admitting no infinity at all (real or complex) -- Arctan/Arccot next door already accept
// `signed_infinity`.
//
// arccos(z) = pi/2 - arcsin(z), so its directions are arcsin's negated.
//
// At the undirected ComplexInfinity the direction varies but the magnitude doesn't:
// arcsin(z) = -i ln(iz + sqrt(1 - z^2)) grows like ln|2z| along every direction (DLMF
// 4.23.19), so the limit is the unsigned ComplexInfinity, as Wolfram answers.
export function evaluateArcsinArccosAtInfinity(ce: ComputeEngine): void {
  widenSignature(
    ce,
    "Arcsin",
    "(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo | Indeterminate",
    () => true,
  );
  wrapOperator(
    ce,
    ["Arcsin"],
    (ops) => ops[0] !== undefined && isAnyInfinity(ops[0]),
    () => (ops) => {
      const z = ops[0]!;
      if (isPositiveInfinity(z)) return directedInfinity(ce, negI(ce));
      if (isNegativeInfinity(z)) return directedInfinity(ce, ce.symbol("ImaginaryUnit"));
      return ce.symbol("ComplexInfinity");
    },
    1,
  );

  widenSignature(
    ce,
    "Arccos",
    "(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo | Indeterminate",
    () => true,
  );
  wrapOperator(
    ce,
    ["Arccos"],
    (ops) => ops[0] !== undefined && isAnyInfinity(ops[0]),
    () => (ops) => {
      const z = ops[0]!;
      if (isPositiveInfinity(z)) return directedInfinity(ce, ce.symbol("ImaginaryUnit"));
      if (isNegativeInfinity(z)) return directedInfinity(ce, negI(ce));
      return ce.symbol("ComplexInfinity");
    },
    1,
  );
}

// --- Arctan/Arccot at ComplexInfinity ------------------------------------------------------
// Both already answer +-Pi/2 and 0/Pi at the real signed infinities natively; only the
// undirected ComplexInfinity is missing, and for the same reason as Arcsin/Arccos above --
// arctan(z) = (i/2)[ln(1-iz) - ln(1+iz)] converges to +Pi/2 along one family of directions
// and -Pi/2 along another (checked numerically: z = 1e12*e^{i*pi/4} -> Arctan ~ Pi/2, z =
// -1e12*e^{i*pi/4} -> Arctan ~ -Pi/2), so no single value exists at the direction-less
// infinity -- Indeterminate.
export function evaluateArctanArccotAtComplexInfinity(ce: ComputeEngine): void {
  for (const head of ["Arctan", "Arccot"] as const) {
    widenSignature(ce, head, "(complex | signed_infinity | ~oo) -> number | Indeterminate", () => true);
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0] !== undefined && isComplexInfinity(ops[0]),
      () => () => indeterminate(ce),
      1,
    );
  }
}

// --- Hyperbolic inverses: the boxing gaps only -------------------------------------------
// Arsinh/Artanh/Arcoth/Arcsch already answer every infinity correctly natively (Arcoth and
// Arcsch even fold ComplexInfinity to 0, since 1/ComplexInfinity = 0 regardless of
// direction). Arcosh(-Infinity) is the one real-axis gap: principal arccosh keeps Re >= 0
// everywhere (DLMF 4.37.5 fixes the branch), so both signed infinities diverge along +1,
// not just +Infinity -- Arcosh(x) = ln(x + sqrt(x^2-1)) ~ ln(2x) directly for x -> +Infinity,
// and for x -> -Infinity the boundary value ln(2|x|) + i*Pi still has its imaginary part
// bounded, same drop-the-finite-part rule as Arcsin/Arccos above.
//
// Arsinh/Arcosh/Artanh/Arsech all reject the undirected ComplexInfinity at boxing
// (`complex | signed_infinity`, no `~oo`). Arsinh grows like ln|2z| with an imaginary part
// that follows the direction (DLMF 4.37.16), so it is ComplexInfinity there, like Arcsin.
// Arcosh's real part alone diverges (arccosh z ~ ln 2z, DLMF 4.37.19, Re >= 0 on the
// principal branch), so it is +Infinity in every direction, as Wolfram has it. Artanh and
// Arsech stay bounded but approach +-i*Pi/2 by direction -- Indeterminate.
export function evaluateHyperbolicInverseAtInfinity(ce: ComputeEngine): void {
  widenSignature(
    ce,
    "Arcosh",
    "(complex | signed_infinity | ~oo) -> number | signed_infinity | Indeterminate",
    () => true,
  );
  wrapOperator(
    ce,
    ["Arcosh"],
    (ops) => ops[0] !== undefined && isNegativeInfinity(ops[0]),
    () => () => ce.symbol("PositiveInfinity"),
    1,
  );

  for (const head of ["Arsinh", "Arcosh", "Artanh", "Arsech"] as const) {
    const unbounded = head === "Arsinh" || head === "Arcosh";
    widenSignature(
      ce,
      head,
      unbounded
        ? "(complex | signed_infinity | ~oo) -> number | signed_infinity | ~oo"
        : "(complex | signed_infinity | ~oo) -> number | signed_infinity | Indeterminate",
      () => true,
    );
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0] !== undefined && isComplexInfinity(ops[0]),
      () => () =>
        head === "Arcosh"
          ? ce.symbol("PositiveInfinity")
          : unbounded
            ? ce.symbol("ComplexInfinity")
            : indeterminate(ce),
      1,
    );
  }
}

// --- Tan/Cot/Sec/Csc at every infinity -----------------------------------------------------
// Unlike Sin/Cos (bounded, oscillating between -1 and 1 -- CE already answers
// Interval(-1, 1) there, see trig-infinity.ts), Tan/Cot/Sec/Csc have poles spaced pi apart:
// as the real argument grows without bound the value passes arbitrarily close to every pole
// infinitely often, so it neither converges nor stays within any bounded interval. No
// limit, in any sense -- Indeterminate, for the real signed infinities same as the
// direction-less ComplexInfinity.
export function evaluateReciprocalTrigAtInfinity(ce: ComputeEngine): void {
  for (const head of ["Tan", "Cot", "Sec", "Csc"] as const) {
    widenSignature(ce, head, "(complex | signed_infinity | ~oo) -> number | Indeterminate", () => true);
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0] !== undefined && isAnyInfinity(ops[0]),
      () => () => indeterminate(ce),
      1,
    );
  }
}

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
