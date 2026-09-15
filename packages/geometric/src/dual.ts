import type { ComputeEngine } from "@cortex-js/compute-engine";
import {
  addMultivectors,
  type Generator,
  multiplyBlades,
  multiplyMultivectors,
  type Multivector,
} from "@enumeratio/hypercomplex";
import { inBlade, same, scale, term, zero } from "./blades.ts";
import { cliffordConjugate, wedge } from "./products.ts";

// Duality, and the two operations that need it. Unlike everything in products.ts,
// these depend on an AMBIENT ALGEBRA: the dual of a blade is its complement, and a
// complement is only defined once you say what it is a complement in. `e_1` in Cl(2,0)
// dualises to `e_2`; the same `e_1` in Cl(3,0) dualises to `e_2e_3`. There is no way to
// read that off the expression, so the algebra is an argument.

/** The top blade of an algebra: every generator, in canonical order, coefficient one. */
export const pseudoscalar = (ce: ComputeEngine, generators: readonly Generator[]): Multivector =>
  term(generators, ce.number(1));

/**
 * The **Poincaré dual** `!a` — for each blade, the blade on the generators it does NOT
 * contain, signed so that `b ∧ !b = I`.
 *
 * This is deliberately not "multiply by the inverse pseudoscalar", which is the
 * definition most texts give and which dies the moment the metric is degenerate: in
 * PGA the pseudoscalar squares to zero and has no inverse at all, so a dual defined
 * through it does not exist. The complement is a statement about which generators
 * are present, and it survives — which is the whole reason projective geometric
 * algebra can be done this way.
 *
 * `undefined` when `mv` uses a generator the algebra does not have, since a complement
 * taken in the wrong ambient space is not a wrong answer so much as a different one.
 */
export function poincareDual(
  ce: ComputeEngine,
  mv: Multivector,
  generators: readonly Generator[],
): Multivector | undefined {
  const parts: Multivector[] = [];
  for (const t of mv.terms.values()) {
    if (!t.blade.every((g) => generators.some((h) => same(g, h)))) return undefined;
    const complement = generators.filter((g) => !inBlade(t.blade, g));
    // The blade and its complement are disjoint, so this product is pure reordering:
    // no generator squares, and the sign is exactly the sign of the shuffle. Asking
    // for it this way keeps one definition of "the sign of sorting a word" in play.
    const { sign } = multiplyBlades(t.blade, complement);
    if (sign === 0) continue; // unreachable for disjoint blades; not worth asserting
    parts.push(term(complement, scale(ce, t.coefficient, sign)));
  }
  return parts.length === 0 ? zero : addMultivectors(ce, parts);
}

/**
 * The regressive (vee) product `a ∨ b` — the wedge of the duals, dualised back.
 *
 * Where the wedge JOINS, the vee MEETS, and which is which depends on whether you read
 * vectors as points or as hyperplanes. In the dual construction PGA uses, a point is a
 * top-grade blade, so `∨` is the join of points and `∧` is the meet of lines.
 */
export function vee(
  ce: ComputeEngine,
  a: Multivector,
  b: Multivector,
  generators: readonly Generator[],
): Multivector | undefined {
  const da = poincareDual(ce, a, generators);
  const db = poincareDual(ce, b, generators);
  if (da === undefined || db === undefined) return undefined;
  return poincareDual(ce, wedge(ce, da, db), generators);
}

/**
 * The sandwich `a ⌷ b` = `a b ā` — how a versor acts, and ganja's `>>>`.
 *
 * The trailing factor is the Clifford conjugate, following ganja. On an even versor —
 * a rotor, a translator, a motor, which is every case this is reached for — the
 * conjugate and the reverse agree, so this is the familiar `R x R̃`.
 */
export const sandwich = (ce: ComputeEngine, a: Multivector, b: Multivector): Multivector =>
  multiplyMultivectors(ce, multiplyMultivectors(ce, a, b), cliffordConjugate(ce, a));
