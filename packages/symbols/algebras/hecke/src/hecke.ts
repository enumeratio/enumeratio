// The Iwahori–Hecke algebra H_n(q): a q-DEFORMATION, which is a different way of
// parameterising a family from anything here so far.
//
// The algebras built before this one were parameterised by their basis — which units,
// which diagrams. This one keeps the basis of the symmetric group algebra exactly (one
// element T_w per permutation, so dimension n!) and deforms the MULTIPLICATION by a
// parameter q. Setting q = 1 gives back ℂS_n on the nose; every other q gives something
// that is not a group algebra at all.
//
// The whole multiplication is one rule, applied one simple reflection at a time:
//
//     T_s · T_w  =  T_{sw}                       if ℓ(sw) > ℓ(w)      (length goes up)
//                =  q·T_{sw} + (q−1)·T_w         if ℓ(sw) < ℓ(w)      (length goes down)
//
// The second line is the deformation. At q = 1 it collapses to T_{sw}, and the two cases
// become one. Because the right-hand side is a SUM, a product of two basis elements is a
// linear combination — the first family here whose product does not land back on a single
// basis element times a scalar.

/** A permutation in one-line notation: `perm[i]` is the image of i+1, values 1…n. */
export type Permutation = readonly number[];

export const permutationKey = (w: Permutation): string => w.join(",");

export const identityPermutation = (n: number): Permutation =>
  Array.from({ length: n }, (_, i) => i + 1);

/** Coxeter length: the number of inversions of `w`. */
export function length(w: Permutation): number {
  let inversions = 0;
  for (let i = 0; i < w.length; i++) {
    for (let j = i + 1; j < w.length; j++) if (w[i]! > w[j]!) inversions++;
  }
  return inversions;
}

/** The simple reflection s_i, swapping i and i+1 (1-indexed). */
export function simpleReflection(n: number, i: number): Permutation {
  const w = identityPermutation(n).slice();
  [w[i - 1], w[i]] = [w[i]!, w[i - 1]!];
  return w;
}

/** Compose: (u·v)(k) = u(v(k)). */
export function compose(u: Permutation, v: Permutation): Permutation {
  return v.map((image) => u[image - 1]!);
}

/** Every permutation of n, in lexicographic order. */
export function permutations(n: number): Permutation[] {
  if (n <= 0) return [[]];
  const out: Permutation[] = [];
  const walk = (prefix: number[], rest: number[]): void => {
    if (rest.length === 0) {
      out.push([...prefix]);
      return;
    }
    for (const [index, value] of rest.entries()) {
      walk([...prefix, value], [...rest.slice(0, index), ...rest.slice(index + 1)]);
    }
  };
  walk([], identityPermutation(n).slice());
  return out;
}

/**
 * A reduced word for `w`: indices of simple reflections whose product is w, of minimal
 * length. Found greedily — repeatedly move a descent down — which is standard and
 * terminates because each step drops the length by exactly one.
 */
export function reducedWord(w: Permutation): number[] {
  const word: number[] = [];
  let current = w.slice();
  for (;;) {
    const descent = current.findIndex(
      (value, i) => i + 1 < current.length && value > current[i + 1]!,
    );
    if (descent === -1) break;
    const i = descent + 1; // 1-indexed simple reflection
    word.unshift(i);
    // Right-multiply by s_i: swap positions i and i+1.
    [current[i - 1], current[i]] = [current[i]!, current[i - 1]!];
  }
  return word;
}

// ── elements of the algebra ─────────────────────────────────────────────────────

/**
 * An element: a coefficient per basis element T_w. Coefficients are carried by the
 * caller (compute-engine expressions, so they stay exact polynomials in q); this module
 * only needs to know how to add and multiply them, which it takes as an interface.
 */
export interface Coefficients<C> {
  readonly zero: C;
  readonly one: C;
  add(a: C, b: C): C;
  multiply(a: C, b: C): C;
  /** The deformation parameter itself. */
  readonly q: C;
  /** q − 1, the coefficient that vanishes at q = 1. */
  readonly qMinusOne: C;
  isZero(a: C): boolean;
}

export type Element<C> = ReadonlyMap<string, { w: Permutation; coefficient: C }>;

export function scale<C>(ring: Coefficients<C>, element: Element<C>, factor: C): Element<C> {
  const out = new Map<string, { w: Permutation; coefficient: C }>();
  for (const [key, term] of element) {
    const coefficient = ring.multiply(factor, term.coefficient);
    if (!ring.isZero(coefficient)) out.set(key, { w: term.w, coefficient });
  }
  return out;
}

export function add<C>(ring: Coefficients<C>, parts: readonly Element<C>[]): Element<C> {
  const out = new Map<string, { w: Permutation; coefficient: C }>();
  for (const part of parts) {
    for (const [key, term] of part) {
      const existing = out.get(key);
      const coefficient =
        existing === undefined
          ? term.coefficient
          : ring.add(existing.coefficient, term.coefficient);
      if (ring.isZero(coefficient)) out.delete(key);
      else out.set(key, { w: term.w, coefficient });
    }
  }
  return out;
}

export const basisElement = <C>(ring: Coefficients<C>, w: Permutation): Element<C> =>
  new Map([[permutationKey(w), { w, coefficient: ring.one }]]);

/**
 * Left-multiply an element by the generator T_{s_i} — the one rule the whole algebra is
 * built from. Everything else is iteration.
 */
function multiplyByGenerator<C>(ring: Coefficients<C>, i: number, element: Element<C>): Element<C> {
  const parts: Element<C>[] = [];
  for (const term of element.values()) {
    const w = term.w;
    const s = simpleReflection(w.length, i);
    const sw = compose(s, w);
    if (length(sw) > length(w)) {
      // Length went up: the undeformed case.
      parts.push(new Map([[permutationKey(sw), { w: sw, coefficient: term.coefficient }]]));
    } else {
      // Length went down: q·T_{sw} + (q−1)·T_w. This is the deformation, and it is the
      // only place q enters.
      parts.push(
        new Map([
          [permutationKey(sw), { w: sw, coefficient: ring.multiply(ring.q, term.coefficient) }],
        ]),
        new Map([
          [permutationKey(w), { w, coefficient: ring.multiply(ring.qMinusOne, term.coefficient) }],
        ]),
      );
    }
  }
  return add(ring, parts);
}

/**
 * T_u · x. Decompose u into simple reflections and apply them right to left — valid
 * because T_u is the product of the T_{s_i} over ANY reduced word for u, which is the
 * braid relation doing its job.
 */
export function multiplyByBasis<C>(
  ring: Coefficients<C>,
  u: Permutation,
  element: Element<C>,
): Element<C> {
  let result = element;
  const word = reducedWord(u);
  for (let k = word.length - 1; k >= 0; k--) {
    result = multiplyByGenerator(ring, word[k]!, result);
  }
  return result;
}

/** The full product of two elements, bilinear over the coefficients. */
export function multiply<C>(ring: Coefficients<C>, a: Element<C>, b: Element<C>): Element<C> {
  const parts: Element<C>[] = [];
  for (const term of a.values()) {
    parts.push(scale(ring, multiplyByBasis(ring, term.w, b), term.coefficient));
  }
  return add(ring, parts);
}
