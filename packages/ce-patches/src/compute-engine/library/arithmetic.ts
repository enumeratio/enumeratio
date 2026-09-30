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
