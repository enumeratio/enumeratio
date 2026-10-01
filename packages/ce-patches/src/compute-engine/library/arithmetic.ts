import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { defineOverload, widenSignature, wrapOperator } from "@enumeratio/engine";

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

// Round's declared carrier is `real | signed_infinity, integer?` -- the same boxing gap as
// Ceil/Floor above, and the same answer: rounding an infinite magnitude with no direction
// is still that magnitude (Wolfram: Round[ComplexInfinity] = ComplexInfinity). The optional
// digits argument doesn't change that -- the handler ignores it, same as native Round
// ignores it once the value itself is already an integer or an infinity.
export function evaluateRoundAtComplexInfinity(ce: ComputeEngine): void {
  widenSignature(ce, "Round", "(real | signed_infinity | ~oo, integer?) -> real | signed_infinity | ~oo", () => true);
  wrapOperator(
    ce,
    ["Round"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "ComplexInfinity",
    () => () => ce.symbol("ComplexInfinity"),
    { min: 1, max: 2 },
  );
}

// Sign(z) = z/|z| needs a direction to answer with; the undirected ComplexInfinity has
// none, unlike the real signed infinities (Sign(+-Infinity) = +-1, already native) -- same
// direction-dependence as Arctan/Erfc's ComplexInfinity case elsewhere in this patch.
// Wolfram: Sign[ComplexInfinity] = Indeterminate.
export function evaluateSignAtComplexInfinity(ce: ComputeEngine): void {
  widenSignature(ce, "Sign", "(complex | signed_infinity | ~oo) -> complex | Indeterminate", () => true);
  wrapOperator(
    ce,
    ["Sign"],
    (ops: readonly BoxedExpression[]) => ops[0]?.json === "ComplexInfinity",
    () => () => ce.symbol("Indeterminate"),
    1,
  );
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

// --- Power(a, ComplexInfinity), and Exp(ComplexInfinity) through it ---------------------
// `Exp(z)` canonicalizes to `Power(ExponentialE, z)` at BOXING time, before any
// `Exp`-headed wrapper ever runs (see complex-expand.ts's own comment on the same quirk),
// so the fix has to sit on `Power`'s own exponent side. `Power` is shared and heavily
// overloaded -- hypercomplex, residues, numerals and adeles each already carry a `Power`
// row of their own (`defineOverload`, `@enumeratio/engine`), and so does this package's own
// tagged-arithmetic gate (declare-tagged-arithmetic.ts) -- but `defineOverload`'s table
// exists precisely so a new row doesn't disturb any of those: each row's `signature` only
// ever widens the head's overall type by union (`joinSignatures` intersects call SHAPES,
// the same trick TypeScript's overloaded functions use, not operand types), and every
// existing row keeps its own `on`/`when` gate untouched. So this widens narrowly rather
// than replacing compute-engine's own `(complex | infinity, complex | signed_infinity) ->
// number` outright, and declines (via `native`) rather than letting the native handler's
// own case-less branch answer an `incompatible-type` Error for any base this doesn't cover.
//
// a^z = e^(z ln a) for a real and positive: bounded and equal to a itself along Re(z) = 0,
// but unbounded as Re(z) -> +-Infinity in whichever direction ln(a) has the same sign as --
// direction-dependent, so no limit. a = 1 is Indeterminate too: 1^Infinity is an
// indeterminate form, as compute-engine itself answers for 1^(+-Infinity). Negative, complex or
// unit-modulus bases besides 1 are left alone: (-1)^z or i^z oscillate around the unit
// circle without a bounded direction-free magnitude either way, a different (and murkier)
// case this patch doesn't attempt.
const isPositiveRealConstant = (op: BoxedExpression | undefined): boolean =>
  op !== undefined && op.im === 0 && Number.isFinite(op.re) && op.re > 0;

export function evaluatePowerAtComplexInfinity(ce: ComputeEngine): void {
  defineOverload(ce, "Power", {
    package: "analytic",
    signature: "(complex | infinity, complex | signed_infinity | ~oo) -> number | Indeterminate",
    arity: 2,
    when: (ops) => ops[1]?.json === "ComplexInfinity" && isPositiveRealConstant(ops[0]),
    // Declines the native handler for any OTHER base beside a ComplexInfinity exponent --
    // it has no case for `~oo` and would otherwise answer its own incompatible-type Error,
    // now that boxing itself accepts the call. Leaves it correctly unevaluated instead.
    native: (op) => op.json !== "ComplexInfinity",
    evaluate: () => ce.symbol("Indeterminate"),
  });
}

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

// --- Re/Im of a directed infinity ---------------------------------------------------------
// Wolfram: Re[DirectedInfinity[d]] is the infinity of Re[d]'s sign (0 when d is purely
// imaginary), so Re[I Infinity] = 0 and Re[(1+I) Infinity] = Infinity; Im likewise. The
// undirected ComplexInfinity has no direction and stays Indeterminate, as native. Its
// magnitude is +Infinity whatever the direction (Abs[I Infinity] = Infinity).
export function evaluateRealImaginaryOfDirectedInfinity(ce: ComputeEngine): void {
  wrapOperator(
    ce,
    ["Abs"],
    (ops: readonly BoxedExpression[]) => ops[0]?.operator === "DirectedInfinity",
    () => () => ce.symbol("PositiveInfinity"),
    1,
  );
  for (const [head, part] of [
    ["Real", "re"],
    ["Imaginary", "im"],
  ] as const) {
    wrapOperator(
      ce,
      [head],
      (ops: readonly BoxedExpression[]) => ops[0]?.operator === "DirectedInfinity",
      () => (ops) => {
        const direction = (ops[0] as unknown as { ops?: readonly BoxedExpression[] }).ops?.[0];
        const component = direction === undefined ? Number.NaN : direction[part];
        if (Number.isNaN(component)) return undefined;
        if (component === 0) return ce.Zero;
        return ce.symbol(component > 0 ? "PositiveInfinity" : "NegativeInfinity");
      },
      1,
    );
  }
}
