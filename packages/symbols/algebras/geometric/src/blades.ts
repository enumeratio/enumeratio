import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import {
  addMultivectors,
  type Generator,
  generatorSymbol,
  multiplyBlades,
  type Multivector,
} from "@enumeratio/hypercomplex";

// The blade-level plumbing the rest of this package is written against.
//
// `@enumeratio/hypercomplex` owns the representation — a multivector is a coefficient
// per blade, and a blade is an ordered word of distinct generators — and owns the
// geometric product. Everything here is a GRADE-SELECTING view of that product, which
// is what turns a Clifford algebra into a geometric one: the outer product is the
// top-grade part, the contractions are the bottom-grade parts, and the involutions are
// a sign per grade. None of it needs a second representation.

/** The canonical key hypercomplex maps blades by. Rebuilt here; it is one line. */
export const bladeKey = (blade: readonly Generator[]): string => blade.map(generatorSymbol).join("*");

/**
 * A one-blade multivector, unnormalised.
 *
 * Callers hand these to `addMultivectors`, which is what collects like blades and drops
 * the zeros — so this never has to know whether the coefficient survived.
 */
export const term = (blade: readonly Generator[], coefficient: BoxedExpression): Multivector => ({
  terms: new Map([[bladeKey(blade), { blade, coefficient }]]),
});

/** The empty multivector — the additive identity, and what a total cancellation is. */
export const zero: Multivector = { terms: new Map() };

/** Multiply two coefficient expressions, keeping them exact. */
export const scale = (ce: ComputeEngine, coefficient: BoxedExpression, sign: -1 | 1): BoxedExpression =>
  sign === 1 ? coefficient : ce.function("Multiply", [ce.number(-1), coefficient]).evaluate();

/**
 * The part of `a · b` in the grade `pick` asks for, summed over every pair of blades.
 *
 * This ONE function is the outer product, both contractions and the scalar product:
 * each is the geometric product with a different grade selected out of it, and taking
 * the selection per blade pair rather than after the fact is what makes it bilinear
 * for free. A degenerate generator needs no special case either — a repeat sends the
 * blade product to zero, which is exactly what the wedge of two blades sharing a
 * generator should be.
 */
export function gradedProduct(
  ce: ComputeEngine,
  a: Multivector,
  b: Multivector,
  pick: (gradeA: number, gradeB: number) => number,
): Multivector {
  const parts: Multivector[] = [];
  for (const x of a.terms.values()) {
    for (const y of b.terms.values()) {
      const wanted = pick(x.blade.length, y.blade.length);
      if (wanted < 0) continue;
      const { sign, blade } = multiplyBlades(x.blade, y.blade);
      if (sign === 0 || blade.length !== wanted) continue;
      const coefficient = ce.function("Multiply", [x.coefficient, y.coefficient]).evaluate();
      parts.push(term(blade, scale(ce, coefficient, sign)));
    }
  }
  return parts.length === 0 ? zero : addMultivectors(ce, parts);
}

/** Apply a sign that depends only on a blade's grade — every involution is one of these. */
export function bySign(ce: ComputeEngine, mv: Multivector, sign: (grade: number) => -1 | 1): Multivector {
  const parts = [...mv.terms.values()].map((t) => term(t.blade, scale(ce, t.coefficient, sign(t.blade.length))));
  return parts.length === 0 ? zero : addMultivectors(ce, parts);
}

/** The grades actually present in `mv`, ascending. */
export function gradesOf(mv: Multivector): number[] {
  const grades = new Set<number>();
  for (const t of mv.terms.values()) grades.add(t.blade.length);
  return [...grades].sort((a, b) => a - b);
}

/** `mv` restricted to one grade. */
export function gradePart(ce: ComputeEngine, mv: Multivector, grade: number): Multivector {
  const parts = [...mv.terms.values()].filter((t) => t.blade.length === grade).map((t) => term(t.blade, t.coefficient));
  return parts.length === 0 ? zero : addMultivectors(ce, parts);
}

/**
 * Are these the same generator? Identity is (family, index) — the family objects are
 * shared singletons, but comparing the rank says what is meant without relying on that.
 */
export const same = (a: Generator, b: Generator): boolean => a.family.rank === b.family.rank && a.index === b.index;

/** Is `g` one of `blade`'s generators? */
export const inBlade = (blade: readonly Generator[], g: Generator): boolean => blade.some((h) => same(g, h));
