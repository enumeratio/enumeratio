// The ribbon basis of NSym, the fundamental basis of QSym, and the one lattice underneath.
//
// A composition of n is the same data as a SUBSET of {1, …, n−1}: take its partial sums.
// Refining a composition adds elements to that set, coarsening removes them. So the
// compositions of n form a Boolean lattice, and the interesting bases of NSym and QSym are
// got from the obvious ones by summing over that lattice and inverting.
//
//   NSym   H_α = Σ_{β coarsens α} R_β            R_α = Σ_{β coarsens α} (−1)^{ℓ(α)−ℓ(β)} H_β
//   QSym   F_α = Σ_{β refines α} M_β             M_α = Σ_{β refines α} (−1)^{ℓ(β)−ℓ(α)} F_β
//
// The signed sums are Möbius inversion over the Boolean lattice, whose Möbius function is
// (−1)^{|difference|} — the same inversion the incidence package computes in general, here
// in closed form because the lattice is known.
//
// The two directions are opposite (coarsen for NSym, refine for QSym) and that is not a
// typo: NSym and QSym are DUAL, with H dual to M and R dual to F. The duality is the best
// test available, because the two transition matrices are written down separately and
// nothing forces them to be inverse transposes of each other except the mathematics.
//
// Why these bases rather than H and M: the ribbon product has a two-term closed form, the
// ribbon antipode is a single signed basis element, and F is the basis in which QSym is the
// home of quasi-symmetric generating functions for P-partitions and descent sets. They are
// the bases the subject is actually written in.

import { type Composition, compositionKey, combine, type Element, basis, fromKey } from "./hopf.ts";

/** The partial sums of a composition, as the subset of {1, …, n−1} it encodes. */
export function descentSet(a: Composition): number[] {
  const out: number[] = [];
  let total = 0;
  for (let i = 0; i + 1 < a.length; i++) {
    total += a[i] as number;
    out.push(total);
  }
  return out;
}

/** The composition of n whose partial sums are the given subset. */
export function fromDescentSet(set: readonly number[], n: number): Composition | undefined {
  const sorted = [...new Set(set)].sort((x, y) => x - y);
  if (sorted.some((x) => !Number.isSafeInteger(x) || x < 1 || x >= n)) return undefined;
  if (n === 0) return sorted.length === 0 ? [] : undefined;
  const out: number[] = [];
  let previous = 0;
  for (const point of sorted) {
    out.push(point - previous);
    previous = point;
  }
  out.push(n - previous);
  return out;
}

/** Whether β coarsens α — equivalently, β's partial sums are a subset of α's. */
export function coarsens(b: Composition, a: Composition): boolean {
  const sums = new Set(descentSet(a));
  return descentSet(b).every((x) => sums.has(x));
}

/** Every coarsening of a composition: merge adjacent parts, in all ways. */
export function coarsenings(a: Composition): Composition[] {
  const points = descentSet(a);
  const total = a.reduce((x, y) => x + y, 0);
  const out: Composition[] = [];
  for (let mask = 0; mask < 2 ** points.length; mask++) {
    const kept = points.filter((_, i) => (mask >> i) & 1);
    const composition = fromDescentSet(kept, total);
    if (composition !== undefined) out.push(composition);
  }
  return out;
}

/** Every refinement of a composition: split each part, in all ways. */
export function refinements(a: Composition): Composition[] {
  const total = a.reduce((x, y) => x + y, 0);
  if (total === 0) return [[]];
  const points = descentSet(a);
  const held = new Set(points);
  const free = Array.from({ length: total - 1 }, (_, i) => i + 1).filter((x) => !held.has(x));
  const out: Composition[] = [];
  for (let mask = 0; mask < 2 ** free.length; mask++) {
    const added = free.filter((_, i) => (mask >> i) & 1);
    const composition = fromDescentSet([...points, ...added], total);
    if (composition !== undefined) out.push(composition);
  }
  return out;
}

// ── the four change-of-basis maps ───────────────────────────────────────────────

const expand = (
  element: Element,
  images: (a: Composition) => readonly (readonly [Composition, number])[],
): Element =>
  combine(
    [...element].flatMap(([key, coefficient]) =>
      images(fromKey(key)).map(([target, sign]) => [basis(target), coefficient * sign] as const),
    ),
  );

/** R_α written in the complete-homogeneous basis: a signed sum over coarsenings. */
export const ribbonToComplete = (element: Element): Element =>
  expand(element, (a) => coarsenings(a).map((b) => [b, (-1) ** (a.length - b.length)] as const));

/** H_α written in the ribbon basis: the same sum, unsigned. */
export const completeToRibbon = (element: Element): Element =>
  expand(element, (a) => coarsenings(a).map((b) => [b, 1] as const));

/** F_α written in the monomial basis of QSym: an unsigned sum over refinements. */
export const fundamentalToMonomial = (element: Element): Element =>
  expand(element, (a) => refinements(a).map((b) => [b, 1] as const));

/** M_α written in the fundamental basis: the same sum, signed. */
export const monomialToFundamental = (element: Element): Element =>
  expand(element, (a) => refinements(a).map((b) => [b, (-1) ** (b.length - a.length)] as const));

// ── things that are only simple in the new bases ────────────────────────────────

/** Concatenation α·β, the product that is simple in the H basis. */
export const concatenate = (a: Composition, b: Composition): Composition => [...a, ...b];

/**
 * Near-concatenation α ▷ β: join the two, adding α's last part to β's first. It has no
 * meaning in the H basis at all, and it is half of the ribbon product.
 */
export function nearConcatenate(a: Composition, b: Composition): Composition {
  if (a.length === 0) return [...b];
  if (b.length === 0) return [...a];
  return [...a.slice(0, -1), (a[a.length - 1] as number) + (b[0] as number), ...b.slice(1)];
}

/**
 * The ribbon product, in closed form: R_α · R_β = R_{α·β} + R_{α▷β}.
 *
 * Two terms, always. In the H basis the same product is concatenation — simple in its own
 * way — but nothing about H makes this two-term shape visible, which is the argument for
 * carrying a second basis at all.
 */
export function ribbonProduct(a: Composition, b: Composition): Element {
  if (a.length === 0) return basis(b);
  if (b.length === 0) return basis(a);
  return combine([
    [basis(concatenate(a, b)), 1],
    [basis(nearConcatenate(a, b)), 1],
  ]);
}

/**
 * The conjugate (transpose) composition: reverse the composition and swap refinement for
 * coarsening — concretely, complement the descent set inside {1, …, n−1} and reverse.
 *
 * It is the transpose of the ribbon's skew shape, which is why the antipode below is a
 * single term: transposing a ribbon diagram is a genuine involution on compositions.
 */
export function conjugateComposition(a: Composition): Composition {
  const total = a.reduce((x, y) => x + y, 0);
  if (total === 0) return [];
  const held = new Set(descentSet(a));
  const complement = Array.from({ length: total - 1 }, (_, i) => i + 1)
    .filter((x) => !held.has(x))
    .map((x) => total - x)
    .sort((x, y) => x - y);
  return fromDescentSet(complement, total) as Composition;
}

/**
 * The antipode on a ribbon: S(R_α) = (−1)^{|α|} R_{α*}, for α* the conjugate composition.
 *
 * One signed basis element. In the H basis the antipode is an alternating sum over all
 * coarsenings, so this is the clearest possible demonstration of what a good basis buys.
 */
export const ribbonAntipode = (a: Composition): Element =>
  combine([[basis(conjugateComposition(a)), (-1) ** a.reduce((x, y) => x + y, 0)]]);

/** The pairing ⟨H_α, M_β⟩ = δ, extended bilinearly — the duality of NSym and QSym. */
export function pair(left: Element, right: Element): number {
  let total = 0;
  for (const [key, coefficient] of left) {
    total += coefficient * (right.get(key) ?? 0);
  }
  return total;
}

/** A readable name for a basis element, for the docs and the heads. */
export const showComposition = (a: Composition): string =>
  a.length === 0 ? "()" : compositionKey(a);
