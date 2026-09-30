import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { widenSignature, wrapOperator } from "@enumeratio/engine";

// cortex-js/compute-engine: Sqrt(-Infinity) collapses to the undirected ComplexInfinity. The
// principal branch (Sqrt(-x) = i*Sqrt(x) for real x > 0, DLMF 4.2.2) gives an exact direction
// as x -> Infinity: Sqrt(-Infinity) = i*Infinity = DirectedInfinity(i), same as Wolfram.
export function evaluateSqrtAtInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Sqrt"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "NegativeInfinity",
    () => () => ce.function("DirectedInfinity", [ce.symbol("ImaginaryUnit")]).evaluate(),
    1,
  );
}

// Ceil/Floor's declared carrier is `real | signed_infinity` -- the UNDIRECTED
// ComplexInfinity (`~oo`) is off it, so BOXING itself rejects the call ("incompatible-type"),
// before `evaluate` ever runs. Rounding an infinite magnitude with no direction is still
// that same infinite magnitude -- Wolfram's Ceiling/Floor and SymPy's ceiling/floor both
// answer ComplexInfinity/zoo -- so the carrier widens to admit it, and the wrapped
// `evaluate` answers it directly rather than falling through to the (now type-correct, but
// still caseless) native handler.
export function evaluateCeilFloorAtComplexInfinity(ce: ComputeEngine): void {
  for (const head of ["Ceil", "Floor"] as const) {
    widenSignature(ce, head, "(real | signed_infinity | ~oo) -> integer | signed_infinity | ~oo", () => true);
    wrapOperator(
      ce,
      [head],
      (ops: readonly BoxedExpression[]) => ops[0]?.json === "ComplexInfinity",
      () => () => ce.symbol("ComplexInfinity"),
      1,
    );
  }
}

// --- Multiply at the infinities ----------------------------------------------------------
// cortex-js/compute-engine#341: Multiply(c, ±Infinity) collapses straight to the undirected
// ComplexInfinity once c is complex, throwing away the direction a real infinity times a
// finite nonzero complex number still has (Wolfram: DirectedInfinity[c/Abs[c]]). A real c
// already gets the correct ±Infinity natively -- this only steps in off the real axis.

// A real (signed) infinity: PositiveInfinity/NegativeInfinity evaluate to a numeric value
// with `isInfinity === true` and a zero imaginary part, not a "PositiveInfinity" symbol --
// evaluate() has already folded the symbol into that numeric value by the time a wrapped
// Multiply handler sees it.
const isSignedInfinity = (op: BoxedExpression): boolean => op.isInfinity === true && op.im === 0;

// The finite product of every factor but the one signed infinity at `infIndex` -- `undefined`
// when a second infinite factor is present (Infinity * Infinity, Infinity * ComplexInfinity,
// two signed infinities, ...), so the native handler keeps those.
function finiteFactor(
  ce: ComputeEngine,
  ops: readonly BoxedExpression[],
  infIndex: number,
): BoxedExpression | undefined {
  if (ops.some((op, i) => i !== infIndex && op.isInfinity === true)) return undefined;
  const rest = ops.filter((_, i) => i !== infIndex);
  if (rest.length === 0) return undefined;
  return ce.function("Multiply", rest).evaluate();
}

export function evaluateMultiplyDirectedInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Multiply"],
    (ops: readonly BoxedExpression[]) => {
      const infIndex = ops.findIndex(isSignedInfinity);
      if (infIndex === -1) return false;
      const finite = finiteFactor(ce, ops, infIndex);
      return finite !== undefined && finite.isFinite === true && !finite.is(0) && finite.im !== 0;
    },
    () => (ops) => {
      const infIndex = ops.findIndex(isSignedInfinity);
      const finite = finiteFactor(ce, ops, infIndex);
      if (finite === undefined) return undefined;
      const magnitude = ce.function("Abs", [finite]).evaluate();
      const signed = (ops[infIndex]?.re ?? 0) < 0 ? ce.function("Negate", [finite]).evaluate() : finite;
      const direction = ce.function("Divide", [signed, magnitude]).evaluate();
      return ce.function("DirectedInfinity", [direction]).evaluate();
    },
  );
}

// --- Ln at the infinities --------------------------------------------------------------

// Exp(ComplexInfinity) is left OUT of this patch, deliberately: `Exp(z)` canonicalizes to
// `Power(ExponentialE, z)` at BOXING time, before any `Exp`-headed wrapper ever runs (see
// complex-expand.ts's own comment on the same quirk), so the fix would really have to widen
// `Power`'s own exponent signature. `Power` is a shared, heavily-overloaded head -- five
// packages besides compute-engine itself already carry their own manifest row for it
// (hypercomplex, residues, numerals, adeles, this package's own tagged-arithmetic gate),
// each keyed to the exact signature string in place when their row was written -- widening
// it here risks a manifest another lane owns going stale in a way this lane can't fully
// verify. Left for the coordinator: see the report.

// ln(-x) = ln(x) + i*Pi (principal branch, approached from above the (-Infinity, 0] cut):
// the magnitude diverges as x -> +Infinity while the imaginary part stays at the bounded
// Pi, so Ln(NegativeInfinity) is +Infinity, the same "magnitude alone diverges" convention
// Ln(PositiveInfinity) and Ln(ComplexInfinity) already carry (the latter fixed separately,
// in @enumeratio/analytic's elementary-remaining.ts). Boxing already accepts
// NegativeInfinity here -- native evaluate just declines it, leaving it unevaluated.
export function evaluateLnAtNegativeInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Ln"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "NegativeInfinity",
    () => () => ce.symbol("PositiveInfinity"),
    1,
  );
}
