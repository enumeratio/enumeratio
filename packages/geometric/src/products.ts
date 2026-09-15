import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { Multivector } from "@enumeratio/hypercomplex";
import { bySign, gradedProduct } from "./blades.ts";

// The products and involutions of a geometric algebra. Each is the geometric product
// with a grade selected, or a sign per grade — see `gradedProduct` and `bySign`.

/**
 * The outer (wedge) product `a ∧ b` — the TOP grade of the geometric product.
 *
 * It is the metric-free half of the product: two blades sharing a generator wedge to
 * zero whatever that generator squares to, which is why the outer product is the one
 * that still means something in a degenerate metric, and why the exterior algebra is
 * the same operation with nothing else attached.
 */
export const wedge = (ce: ComputeEngine, a: Multivector, b: Multivector): Multivector =>
  gradedProduct(ce, a, b, (x, y) => x + y);

/**
 * The left contraction `a ⌋ b` — the geometric product at grade `|b| − |a|`, and zero
 * when `a` has the higher grade. Geometrically: the part of `b` orthogonal to the
 * projection of `a` onto it. This is ganja's `<<`, unextended and unmodified.
 */
export const leftContraction = (ce: ComputeEngine, a: Multivector, b: Multivector): Multivector =>
  gradedProduct(ce, a, b, (x, y) => y - x);

/** The right contraction `a ⌊ b`, at grade `|a| − |b|` — the left one's mirror. */
export const rightContraction = (ce: ComputeEngine, a: Multivector, b: Multivector): Multivector =>
  gradedProduct(ce, a, b, (x, y) => x - y);

/** The scalar product `a * b` — grade 0 of the geometric product. */
export const scalarProduct = (ce: ComputeEngine, a: Multivector, b: Multivector): Multivector =>
  gradedProduct(ce, a, b, () => 0);

/**
 * Reversion `ã` — reverse the order of the generators in every blade, which costs the
 * sign of reversing a word of length k: `(−1)^(k(k−1)/2)`.
 *
 * This is the involution versors are built on: a rotor `R` acts as `R x R̃`.
 */
export const reversion = (ce: ComputeEngine, mv: Multivector): Multivector =>
  bySign(ce, mv, (k) => (((k * (k - 1)) / 2) % 2 === 0 ? 1 : -1));

/**
 * Grade involution `â` — every generator to its negative, so grade k costs `(−1)^k`.
 *
 * This is the same map hypercomplex already applies for `Conjugate`; it has the
 * geometric-algebra name here because the identities are written with it.
 */
export const gradeInvolution = (ce: ComputeEngine, mv: Multivector): Multivector =>
  bySign(ce, mv, (k) => (k % 2 === 0 ? 1 : -1));

/**
 * Clifford conjugation `ā` — reversion after grade involution, so `(−1)^(k(k+1)/2)`.
 * ganja spells it `~`.
 */
export const cliffordConjugate = (ce: ComputeEngine, mv: Multivector): Multivector =>
  bySign(ce, mv, (k) => (((k * (k + 1)) / 2) % 2 === 0 ? 1 : -1));
