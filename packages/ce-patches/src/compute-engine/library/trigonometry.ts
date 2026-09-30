import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
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
// At the undirected ComplexInfinity, the limit genuinely depends on the direction of
// approach (real +Infinity and real -Infinity alone already disagree, -i vs +i) --
// Indeterminate, the same "no single answer" convention CE 0.141 gives Gamma/Factorial/
// Zeta/Digamma/PolyGamma at ComplexInfinity.
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
      return indeterminate(ce);
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
      return indeterminate(ce);
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
// (`complex | signed_infinity`, no `~oo`) for the same direction-dependent reason as
// Arcsin/Arctan -- Indeterminate.
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
    widenSignature(
      ce,
      head,
      "(complex | signed_infinity | ~oo) -> number | signed_infinity | Indeterminate",
      () => true,
    );
    wrapOperator(
      ce,
      [head],
      (ops) => ops[0] !== undefined && isComplexInfinity(ops[0]),
      () => () => indeterminate(ce),
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
