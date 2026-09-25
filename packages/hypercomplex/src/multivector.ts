import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  compareGenerators,
  type Generator,
  generatorOf,
  generatorSymbol,
  sameGenerator,
} from "./units.ts";
import { operandsOf, symbolNameOf } from "@enumeratio/boxed";

// A hypercomplex element in normal form: a coefficient per BLADE, where a blade is
// an ordered product of distinct generators (the empty blade is the scalar). Every
// algebra in units.ts is spanned by its blades, so one representation covers all of
// them — the family data only enters when two blades are multiplied.
//
// Coefficients are BoxedExpressions, not numbers, so exactness survives: rationals
// stay rational, π stays π, and an undetermined symbol stays symbolic.

/** Blade key: the generators' canonical symbols, joined. `""` is the scalar blade. */
type BladeKey = string;

interface Term {
  readonly blade: readonly Generator[];
  readonly coefficient: BoxedExpression;
}

/** An element of a hypercomplex algebra, as blade → coefficient. */
export interface Multivector {
  readonly terms: ReadonlyMap<BladeKey, Term>;
}

const bladeKey = (blade: readonly Generator[]): BladeKey => blade.map(generatorSymbol).join("*");

/** Sum a list of coefficient expressions, keeping them exact. */
const sumCoefficients = (ce: ComputeEngine, xs: readonly BoxedExpression[]): BoxedExpression =>
  xs.length === 1 ? xs[0]! : ce.function("Add", xs).evaluate();

const productCoefficients = (ce: ComputeEngine, xs: readonly BoxedExpression[]): BoxedExpression =>
  xs.length === 1 ? xs[0]! : ce.function("Multiply", xs).evaluate();

/** Definitely zero — an unknown symbolic coefficient answers `false`, not "maybe". */
const isDefinitelyZero = (x: BoxedExpression): boolean => x.is(0) === true;

/** Build a multivector from raw (blade, coefficient) pairs, collecting like blades. */
function fromTerms(ce: ComputeEngine, raw: readonly Term[]): Multivector {
  const pending = new Map<BladeKey, { blade: readonly Generator[]; parts: BoxedExpression[] }>();
  for (const term of raw) {
    if (isDefinitelyZero(term.coefficient)) continue;
    const key = bladeKey(term.blade);
    const slot = pending.get(key);
    if (slot === undefined) pending.set(key, { blade: term.blade, parts: [term.coefficient] });
    else slot.parts.push(term.coefficient);
  }
  const terms = new Map<BladeKey, Term>();
  for (const [key, slot] of pending) {
    const coefficient = sumCoefficients(ce, slot.parts);
    if (isDefinitelyZero(coefficient)) continue; // cancellation, e.g. i_1 − i_1
    terms.set(key, { blade: slot.blade, coefficient });
  }
  return { terms };
}

export const scalarMultivector = (ce: ComputeEngine, c: BoxedExpression): Multivector =>
  fromTerms(ce, [{ blade: [], coefficient: c }]);

export const isScalar = (mv: Multivector): boolean =>
  [...mv.terms.values()].every((t) => t.blade.length === 0);

/** The generators occurring anywhere in `mv`, in canonical order. */
export function generatorsOf(mv: Multivector): Generator[] {
  const found: Generator[] = [];
  for (const term of mv.terms.values()) {
    for (const g of term.blade) {
      if (!found.some((h) => sameGenerator(g, h))) found.push(g);
    }
  }
  return found.sort(compareGenerators);
}

// ── the blade product ────────────────────────────────────────────────────────────
// Concatenate the two blades into a word, sort it into canonical order (each swap of
// two DISTINCT anticommuting generators costs a sign; every other swap is free), then
// collapse the runs of equal generators through their squares. The commutation factor
// ε(g,h) = (−1)^(anti(g)·anti(h)) is a bicharacter, so the product is associative
// whether the families commute, anticommute, or mix.

/** Sort a generator word into canonical order, tracking the anticommutation sign. */
function sortWord(word: readonly Generator[]): { sign: 1 | -1; sorted: Generator[] } {
  const w = word.slice();
  let sign: 1 | -1 = 1;
  for (let i = 1; i < w.length; i++) {
    for (let k = i; k > 0 && compareGenerators(w[k - 1]!, w[k]!) > 0; k--) {
      if (w[k - 1]!.family.anticommutes && w[k]!.family.anticommutes) sign = sign === 1 ? -1 : 1;
      const swap = w[k - 1]!;
      w[k - 1] = w[k]!;
      w[k] = swap;
    }
  }
  return { sign, sorted: w };
}

/** j_A · j_B = sign · j_C. `sign` is 0 when a nilpotent generator repeats. */
export function multiplyBlades(
  a: readonly Generator[],
  b: readonly Generator[],
): { sign: -1 | 0 | 1; blade: Generator[] } {
  const { sign: swapSign, sorted } = sortWord([...a, ...b]);
  let sign: -1 | 0 | 1 = swapSign;
  const blade: Generator[] = [];
  for (let i = 0; i < sorted.length;) {
    let run = 1;
    while (i + run < sorted.length && sameGenerator(sorted[i]!, sorted[i + run]!)) run++;
    const square = sorted[i]!.family.square;
    const pairs = run >> 1;
    if (pairs > 0) {
      if (square === 0) return { sign: 0, blade: [] };
      if (square === -1 && pairs % 2 === 1) sign = (sign === 0 ? 0 : -sign) as -1 | 0 | 1;
    }
    if (run % 2 === 1) blade.push(sorted[i]!);
    i += run;
  }
  return { sign, blade };
}

// ── multivector arithmetic ──────────────────────────────────────────────────────

export function addMultivectors(ce: ComputeEngine, parts: readonly Multivector[]): Multivector {
  const raw: Term[] = [];
  for (const mv of parts) raw.push(...mv.terms.values());
  return fromTerms(ce, raw);
}

export function scaleMultivector(
  ce: ComputeEngine,
  mv: Multivector,
  factor: BoxedExpression,
): Multivector {
  return fromTerms(
    ce,
    [...mv.terms.values()].map((t) => ({
      blade: t.blade,
      coefficient: productCoefficients(ce, [factor, t.coefficient]),
    })),
  );
}

export function multiplyMultivectors(
  ce: ComputeEngine,
  a: Multivector,
  b: Multivector,
): Multivector {
  const raw: Term[] = [];
  for (const x of a.terms.values()) {
    for (const y of b.terms.values()) {
      const { sign, blade } = multiplyBlades(x.blade, y.blade);
      if (sign === 0) continue;
      const factors = [x.coefficient, y.coefficient];
      if (sign === -1) factors.unshift(ce.number(-1));
      raw.push({ blade, coefficient: productCoefficients(ce, factors) });
    }
  }
  return fromTerms(ce, raw);
}

export function powerMultivector(
  ce: ComputeEngine,
  mv: Multivector,
  exponent: number,
): Multivector | undefined {
  if (!Number.isInteger(exponent)) return undefined;
  if (exponent < 0) {
    const inverse = invertMultivector(ce, mv);
    return inverse === undefined ? undefined : powerMultivector(ce, inverse, -exponent);
  }
  let acc = scalarMultivector(ce, ce.number(1));
  let base = mv;
  for (let n = exponent; n > 0; n >>= 1) {
    if (n % 2 === 1) acc = multiplyMultivectors(ce, acc, base);
    base = multiplyMultivectors(ce, base, base);
  }
  return acc;
}

/**
 * Total conjugation: every generator g ↦ −g, so a blade of grade k picks up (−1)^k.
 * A ring automorphism for the commuting families. For multicomplex this is exactly
 * "negate the odd-popcount coefficients" — the map that flips the odious basis units.
 */
export function conjugateMultivector(ce: ComputeEngine, mv: Multivector): Multivector {
  return fromTerms(
    ce,
    [...mv.terms.values()].map((t) => ({
      blade: t.blade,
      coefficient:
        t.blade.length % 2 === 0
          ? t.coefficient
          : productCoefficients(ce, [ce.number(-1), t.coefficient]),
    })),
  );
}

// ── norm and inverse, through the tower ─────────────────────────────────────────
// For the COMMUTING families the algebra is a tower of quadratic extensions: with x
// the largest generator present, A = B[x]/(x² − ε) and every element splits as
// z = u + x·v with u, v ∈ B. Then
//     N_{A/B}(z) = (u + xv)(u − xv) = u² − ε·v²,      z⁻¹ = (u − xv) · (u² − ε·v²)⁻¹,
// and recursing down the tower bottoms out at a scalar. N is the determinant of the
// multiplication-by-z map on A as a rank-2ⁿ module over the scalars (determinants are
// multiplicative through a tower of free extensions), which is the definition that
// survives a MIXED signature — at ℂ_2, z·conj(z) = (a²+b²+c²+d²) + 2(ad−bc)·i_1i_2 is
// not a scalar at all, so the Gaussian N(z) = z·conj(z) shortcut is simply unavailable.
//
// The anticommuting family is left alone: Cl_n is not commutative, its norm is a
// different object, and guessing one would be worse than declining.

const hasAnticommuting = (mv: Multivector): boolean =>
  generatorsOf(mv).some((g) => g.family.anticommutes);

/** Split `mv` at generator `x` into u (blades without x) and v (blades with x removed). */
function splitAt(
  ce: ComputeEngine,
  mv: Multivector,
  x: Generator,
): { u: Multivector; v: Multivector } {
  const low: Term[] = [];
  const high: Term[] = [];
  for (const term of mv.terms.values()) {
    if (term.blade.some((g) => sameGenerator(g, x))) {
      high.push({
        blade: term.blade.filter((g) => !sameGenerator(g, x)),
        coefficient: term.coefficient,
      });
    } else low.push(term);
  }
  return { u: fromTerms(ce, low), v: fromTerms(ce, high) };
}

/** u² − ε·v², the norm of z = u + x·v relative to the next algebra down. */
function relativeNorm(
  ce: ComputeEngine,
  u: Multivector,
  v: Multivector,
  square: -1 | 0 | 1,
): Multivector {
  const uu = multiplyMultivectors(ce, u, u);
  if (square === 0) return uu;
  const vv = multiplyMultivectors(ce, v, v);
  return addMultivectors(ce, [uu, square === 1 ? scaleMultivector(ce, vv, ce.number(-1)) : vv]);
}

/**
 * The algebra norm — the determinant of multiplication-by-z — over the subalgebra
 * GENERATED BY THE UNITS OCCURRING IN `mv`. That ambient choice matters: adjoining
 * one more generator squares the norm (N_{n+1} = N_n²), so N is multiplicative on a
 * FIXED unit set, which is the theorem worth relying on. `undefined` for an
 * anticommuting element.
 */
export function normMultivector(ce: ComputeEngine, mv: Multivector): BoxedExpression | undefined {
  if (hasAnticommuting(mv)) return undefined;
  const generators = generatorsOf(mv);
  if (generators.length === 0) {
    const scalar = mv.terms.get("");
    return scalar?.coefficient ?? ce.number(0);
  }
  const x = generators[generators.length - 1]!;
  const { u, v } = splitAt(ce, mv, x);
  return normMultivector(ce, relativeNorm(ce, u, v, x.family.square));
}

/**
 * z⁻¹, or `undefined` when the element is not invertible (or is anticommuting, or
 * carries a coefficient too symbolic to divide by). Unlike the norm this does not
 * depend on the ambient algebra — an inverse is unique wherever it exists.
 */
export function invertMultivector(ce: ComputeEngine, mv: Multivector): Multivector | undefined {
  if (hasAnticommuting(mv)) return undefined;
  const generators = generatorsOf(mv);
  if (generators.length === 0) {
    const scalar = mv.terms.get("")?.coefficient;
    if (scalar === undefined || isDefinitelyZero(scalar)) return undefined; // 0 has no inverse
    return scalarMultivector(ce, ce.function("Divide", [ce.number(1), scalar]).evaluate());
  }
  const x = generators[generators.length - 1]!;
  const { u, v } = splitAt(ce, mv, x);
  const inverseNorm = invertMultivector(ce, relativeNorm(ce, u, v, x.family.square));
  if (inverseNorm === undefined) return undefined;
  // (u − x·v) · (u² − ε·v²)⁻¹ — the x-conjugate over the relative norm.
  const xConjugate = addMultivectors(ce, [
    u,
    scaleMultivector(ce, embedAt(ce, v, x), ce.number(-1)),
  ]);
  return multiplyMultivectors(ce, xConjugate, inverseNorm);
}

/** Multiply every blade of `mv` by `x` — the inverse of splitAt's high half. */
function embedAt(ce: ComputeEngine, mv: Multivector, x: Generator): Multivector {
  return multiplyMultivectors(ce, mv, fromTerms(ce, [{ blade: [x], coefficient: ce.number(1) }]));
}

// ── expression ↔ multivector ────────────────────────────────────────────────────

/** Does any generator symbol occur in this expression? The dispatch test. */
export function containsGenerator(expr: BoxedExpression): boolean {
  if (generatorOf(symbolNameOf(expr)) !== undefined) return true;
  return operandsOf(expr).some(containsGenerator);
}

/** The heads `toMultivector` reads through; a generator under any other is opaque to it. */
const ARITHMETIC = new Set([
  "Add",
  "Multiply",
  "NonCommutativeMultiply",
  "GeometricProduct",
  "CircleTimes",
  "Negate",
  "Subtract",
  "Power",
  "Divide",
]);

/**
 * Could `toMultivector` find a generator here? Descends only through `ARITHMETIC` (and
 * only a Power's base), so the check on Add and Multiply — which runs on every call — stops
 * at the first non-arithmetic head instead of walking into it.
 */
export function reachesGenerator(expr: BoxedExpression): boolean {
  if (generatorOf(symbolNameOf(expr)) !== undefined) return true;
  const operator = expr.operator;
  if (!ARITHMETIC.has(operator)) return false;
  const ops = operandsOf(expr);
  return operator === "Power"
    ? ops[0] !== undefined && reachesGenerator(ops[0])
    : ops.some(reachesGenerator);
}

/** The distinct ANTICOMMUTING generators in an expression (Clifford `e_k`). */
export function anticommutingGenerators(expr: BoxedExpression): Generator[] {
  const found: Generator[] = [];
  const walk = (e: BoxedExpression): void => {
    const g = generatorOf(symbolNameOf(e));
    if (g?.family.anticommutes === true && !found.some((h) => sameGenerator(g, h))) found.push(g);
    for (const op of operandsOf(e)) walk(op);
  };
  walk(expr);
  return found;
}

/**
 * Whether a product's VALUE is independent of the order of its operands — the
 * question `Multiply` forces, since compute-engine declares it commutative and sorts
 * its operands during canonicalisation, before any evaluate handler of ours runs.
 *
 * Two operands fail to commute only when each carries an anticommuting generator and
 * between them they carry two distinct ones. Everything else is safe: a scalar
 * coefficient beside a blade, `e_1·e_1`, a product with no Clifford unit in it.
 * When it is NOT safe the product is refused rather than answered with a sign that
 * canonicalisation has already thrown away — see `NonCommutativeMultiply`.
 */
export function productIsOrderable(ops: readonly BoxedExpression[]): boolean {
  const carried = ops.map(anticommutingGenerators).filter((gs) => gs.length > 0);
  if (carried.length < 2) return true;
  return (
    carried.flat().reduce<Generator[]>((acc, g) => {
      if (!acc.some((h) => sameGenerator(g, h))) acc.push(g);
      return acc;
    }, []).length < 2
  );
}

/**
 * Whether a juxtaposition already spells its generators in canonical blade order, so
 * that the sort `Multiply` is about to apply is a no-op and nothing is lost by
 * letting it run. Only a word of BARE generators qualifies: a compound factor (a sum,
 * a parenthesised group) occupies no place in the blade order, so where it was
 * written is load-bearing and the product has to keep it.
 */
export function productIsInBladeOrder(ops: readonly BoxedExpression[]): boolean {
  let previous: Generator | undefined;
  for (const op of ops) {
    if (anticommutingGenerators(op).length === 0) continue; // commutes with everything
    const generator = generatorOf(symbolNameOf(op));
    if (generator === undefined) return false;
    if (previous !== undefined && compareGenerators(previous, generator) > 0) return false;
    previous = generator;
  }
  return true;
}

/**
 * Read an expression as a multivector, or `undefined` when it cannot be linearised
 * over the blades — a generator under an opaque head (`Sin(i_1)`), a symbolic
 * exponent, a non-invertible divisor. Returning `undefined` leaves the expression
 * symbolic rather than answering wrongly.
 *
 * A subtree with no generator in it is a SCALAR, whatever it is: that is what keeps
 * coefficients exact and lets π, rationals and free symbols ride along.
 */
export function toMultivector(ce: ComputeEngine, expr: BoxedExpression): Multivector | undefined {
  if (!containsGenerator(expr)) return scalarMultivector(ce, expr);

  const generator = generatorOf(symbolNameOf(expr));
  if (generator !== undefined) {
    return fromTerms(ce, [{ blade: [generator], coefficient: ce.number(1) }]);
  }

  const ops = operandsOf(expr);
  const parsed = (): (Multivector | undefined)[] => ops.map((op) => toMultivector(ce, op));
  const allOf = (): Multivector[] | undefined => {
    const list = parsed();
    return list.every((m): m is Multivector => m !== undefined) ? list : undefined;
  };

  switch (expr.operator) {
    case "Add": {
      const parts = allOf();
      return parts === undefined ? undefined : addMultivectors(ce, parts);
    }
    case "Multiply":
    case "NonCommutativeMultiply":
    case "GeometricProduct":
    case "CircleTimes": {
      const parts = allOf();
      if (parts === undefined) return undefined;
      return parts.reduce((a, b) => multiplyMultivectors(ce, a, b));
    }
    case "Negate": {
      const inner = ops[0] === undefined ? undefined : toMultivector(ce, ops[0]);
      return inner === undefined ? undefined : scaleMultivector(ce, inner, ce.number(-1));
    }
    case "Subtract": {
      const parts = allOf();
      if (parts === undefined || parts.length !== 2) return undefined;
      return addMultivectors(ce, [parts[0]!, scaleMultivector(ce, parts[1]!, ce.number(-1))]);
    }
    case "Power": {
      const base = ops[0] === undefined ? undefined : toMultivector(ce, ops[0]);
      const exponent = ops[1];
      if (base === undefined || exponent === undefined) return undefined;
      if (exponent.im !== 0 || !Number.isInteger(exponent.re)) return undefined;
      return powerMultivector(ce, base, exponent.re);
    }
    case "Divide": {
      const parts = allOf();
      if (parts === undefined || parts.length !== 2) return undefined;
      const inverse = invertMultivector(ce, parts[1]!);
      return inverse === undefined ? undefined : multiplyMultivectors(ce, parts[0]!, inverse);
    }
    default:
      return undefined; // a generator somewhere we cannot see through
  }
}

/** Render a multivector back as an expression, in canonical blade order. */
export function toExpression(ce: ComputeEngine, mv: Multivector): BoxedExpression {
  const terms = [...mv.terms.values()].sort(
    (a, b) => a.blade.length - b.blade.length || bladeKey(a.blade).localeCompare(bladeKey(b.blade)),
  );
  const parts = terms.map((term) => {
    const units = term.blade.map((g) => ce.symbol(generatorSymbol(g)));
    if (units.length === 0) return term.coefficient;
    const factors = term.coefficient.is(1) === true ? units : [term.coefficient, ...units];
    return factors.length === 1 ? factors[0]! : ce.function("Multiply", factors);
  });
  if (parts.length === 0) return ce.number(0);
  return parts.length === 1 ? parts[0]! : ce.function("Add", parts);
}
