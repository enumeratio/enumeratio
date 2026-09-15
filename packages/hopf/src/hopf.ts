// NSym and QSym: two combinatorial Hopf algebras, both indexed by COMPOSITIONS.
//
// Everything built here before this point was an algebra — a product and nothing else.
// A Hopf algebra also has a COPRODUCT, which takes one element to a sum of tensor pairs
// and pulls objects apart where the product puts them together. The two are not
// independent: they must satisfy
//
//     Δ(x·y) = Δ(x) · Δ(y)        (in the tensor square)
//
// and that compatibility is the point of the whole structure. It is also an excellent
// test, because the product and the coproduct are written separately and the identity
// relates them.
//
// NSym — non-commutative symmetric functions, complete basis H_α. The product is
//   CONCATENATION of compositions. It is the free associative algebra on H_1, H_2, …
// QSym — quasi-symmetric functions, monomial basis M_α. The product is the QUASI-SHUFFLE,
//   which interleaves two compositions and may also ADD a part from each. The coproduct
//   is deconcatenation.
//
// The two are dual to each other, which is why one file holds both.

/** A composition: an ordered list of positive parts. */
export type Composition = readonly number[];

export const compositionKey = (a: Composition): string => a.join(",");
export const fromKey = (key: string): Composition => (key === "" ? [] : key.split(",").map(Number));

/** The degree of a basis element: the sum of the parts. */
export const degree = (a: Composition): number => a.reduce((x, y) => x + y, 0);

/** Every composition of n — 2^(n−1) of them for n ≥ 1. */
export function compositions(n: number): Composition[] {
  if (n < 0) return [];
  if (n === 0) return [[]];
  const out: Composition[] = [];
  const walk = (remaining: number, prefix: number[]): void => {
    if (remaining === 0) {
      out.push([...prefix]);
      return;
    }
    for (let part = 1; part <= remaining; part++) walk(remaining - part, [...prefix, part]);
  };
  walk(n, []);
  return out;
}

// ── elements, as integer combinations of basis elements ─────────────────────────

/** An element: a coefficient per composition. */
export type Element = ReadonlyMap<string, number>;

export const basis = (a: Composition): Element => new Map([[compositionKey(a), 1]]);
export const zero: Element = new Map();

export function combine(parts: readonly (readonly [Element, number])[]): Element {
  const out = new Map<string, number>();
  for (const [element, factor] of parts) {
    for (const [key, coefficient] of element) {
      const total = (out.get(key) ?? 0) + coefficient * factor;
      if (total === 0) out.delete(key);
      else out.set(key, total);
    }
  }
  return out;
}

export const plus = (...parts: Element[]): Element => combine(parts.map((p) => [p, 1] as const));

/** A tensor element: a coefficient per ordered pair of compositions. */
export type Tensor = ReadonlyMap<string, number>;

export const tensorKey = (left: Composition, right: Composition): string =>
  `${compositionKey(left)}|${compositionKey(right)}`;

export const splitTensorKey = (key: string): [Composition, Composition] => {
  const [left = "", right = ""] = key.split("|");
  return [fromKey(left), fromKey(right)];
};

function combineTensor(parts: readonly (readonly [Tensor, number])[]): Tensor {
  const out = new Map<string, number>();
  for (const [tensor, factor] of parts) {
    for (const [key, coefficient] of tensor) {
      const total = (out.get(key) ?? 0) + coefficient * factor;
      if (total === 0) out.delete(key);
      else out.set(key, total);
    }
  }
  return out;
}

// ── NSym: product is concatenation ──────────────────────────────────────────────

/** H_α · H_β = H_{αβ}. The free associative algebra on H_1, H_2, … */
export function nsymProduct(a: Element, b: Element): Element {
  const parts: [Element, number][] = [];
  for (const [keyA, ca] of a) {
    for (const [keyB, cb] of b) {
      parts.push([basis([...fromKey(keyA), ...fromKey(keyB)]), ca * cb]);
    }
  }
  return combine(parts);
}

/** (a⊗b)·(c⊗d) = (ac)⊗(bd), concatenating componentwise. */
function nsymTensorProduct(x: Tensor, y: Tensor): Tensor {
  const parts: [Tensor, number][] = [];
  for (const [keyX, cx] of x) {
    const [xl, xr] = splitTensorKey(keyX);
    for (const [keyY, cy] of y) {
      const [yl, yr] = splitTensorKey(keyY);
      parts.push([new Map([[tensorKey([...xl, ...yl], [...xr, ...yr]), 1]]), cx * cy]);
    }
  }
  return combineTensor(parts);
}

/**
 * Δ(H_n) = Σ_{i+j=n} H_i ⊗ H_j, with H_0 = 1, extended as an ALGEBRA MAP — so the
 * coproduct of a composition is the tensor product of its parts' coproducts. That is
 * what makes NSym a bialgebra rather than merely an algebra with a map on generators.
 */
export function nsymCoproduct(element: Element): Tensor {
  const parts: [Tensor, number][] = [];
  for (const [key, coefficient] of element) {
    const composition = fromKey(key);
    let running: Tensor = new Map([[tensorKey([], []), 1]]);
    for (const part of composition) {
      const single = new Map<string, number>();
      for (let i = 0; i <= part; i++) {
        const left: Composition = i === 0 ? [] : [i];
        const right: Composition = part - i === 0 ? [] : [part - i];
        single.set(tensorKey(left, right), 1);
      }
      running = nsymTensorProduct(running, single);
    }
    parts.push([running, coefficient]);
  }
  return combineTensor(parts);
}

// ── QSym: product is the quasi-shuffle ──────────────────────────────────────────

/**
 * The quasi-shuffle (overlapping shuffle) of two compositions: interleave them, and at
 * each step you may instead ADD the two leading parts together. That third option is
 * what makes this a quasi-shuffle rather than an ordinary shuffle, and it is why
 * M_α·M_β lands on compositions of degree |α|+|β| but of varying length.
 */
export function quasiShuffle(a: Composition, b: Composition): Composition[] {
  if (a.length === 0) return [b];
  if (b.length === 0) return [a];
  const [headA, ...restA] = a;
  const [headB, ...restB] = b;
  return [
    ...quasiShuffle(restA, b).map((tail) => [headA!, ...tail]),
    ...quasiShuffle(a, restB).map((tail) => [headB!, ...tail]),
    ...quasiShuffle(restA, restB).map((tail) => [headA! + headB!, ...tail]),
  ];
}

/** M_α · M_β = Σ over the quasi-shuffles. */
export function qsymProduct(a: Element, b: Element): Element {
  const parts: [Element, number][] = [];
  for (const [keyA, ca] of a) {
    for (const [keyB, cb] of b) {
      for (const shuffled of quasiShuffle(fromKey(keyA), fromKey(keyB))) {
        parts.push([basis(shuffled), ca * cb]);
      }
    }
  }
  return combine(parts);
}

/** (a⊗b)·(c⊗d) = Σ (a∗c)⊗(b∗d), quasi-shuffling componentwise. */
function qsymTensorProduct(x: Tensor, y: Tensor): Tensor {
  const parts: [Tensor, number][] = [];
  for (const [keyX, cx] of x) {
    const [xl, xr] = splitTensorKey(keyX);
    for (const [keyY, cy] of y) {
      const [yl, yr] = splitTensorKey(keyY);
      for (const left of quasiShuffle(xl, yl)) {
        for (const right of quasiShuffle(xr, yr)) {
          parts.push([new Map([[tensorKey(left, right), 1]]), cx * cy]);
        }
      }
    }
  }
  return combineTensor(parts);
}

/** Δ(M_α) = Σ_i M_{α_1..α_i} ⊗ M_{α_{i+1}..α_k} — deconcatenation. */
export function qsymCoproduct(element: Element): Tensor {
  const parts: [Tensor, number][] = [];
  for (const [key, coefficient] of element) {
    const composition = fromKey(key);
    const single = new Map<string, number>();
    for (let i = 0; i <= composition.length; i++) {
      single.set(tensorKey(composition.slice(0, i), composition.slice(i)), 1);
    }
    parts.push([single, coefficient]);
  }
  return combineTensor(parts);
}

// ── the shared Hopf machinery ───────────────────────────────────────────────────

/** One of the two Hopf algebras, as the operations that define it. */
export interface HopfAlgebra {
  readonly name: string;
  product(a: Element, b: Element): Element;
  coproduct(element: Element): Tensor;
  tensorProduct(x: Tensor, y: Tensor): Tensor;
}

export const nsym: HopfAlgebra = {
  name: "NSym",
  product: nsymProduct,
  coproduct: nsymCoproduct,
  tensorProduct: nsymTensorProduct,
};

export const qsym: HopfAlgebra = {
  name: "QSym",
  product: qsymProduct,
  coproduct: qsymCoproduct,
  tensorProduct: qsymTensorProduct,
};

/** The unit: the empty composition, which is 1 in both algebras. */
export const unit: Element = basis([]);

/** The counit ε: picks out the coefficient of the empty composition. */
export const counit = (element: Element): number => element.get("") ?? 0;

/**
 * The antipode S, by the recursion the Hopf axiom forces on a graded connected algebra:
 * from m(S⊗id)Δ = ηε, splitting off the two trivial terms of Δ gives
 *     S(x) = −x − Σ S(x′)·x″
 * over the summands of Δ(x) with both halves non-empty. Degree strictly decreases in the
 * left factor, so the recursion terminates.
 */
export function antipode(algebra: HopfAlgebra, element: Element): Element {
  const parts: [Element, number][] = [];
  for (const [key, coefficient] of element) {
    const composition = fromKey(key);
    if (composition.length === 0) {
      parts.push([unit, coefficient]);
      continue;
    }
    const terms: [Element, number][] = [[basis(composition), -1]];
    for (const [tensor, c] of algebra.coproduct(basis(composition))) {
      const [left, right] = splitTensorKey(tensor);
      if (left.length === 0 || right.length === 0) continue; // the two trivial terms
      terms.push([algebra.product(antipode(algebra, basis(left)), basis(right)), -c]);
    }
    parts.push([combine(terms), coefficient]);
  }
  return combine(parts);
}
