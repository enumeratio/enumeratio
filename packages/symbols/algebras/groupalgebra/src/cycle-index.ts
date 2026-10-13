// Cycle indices of permutation groups: Z(G) = (1/|G|) Σ_g Π x_i^(number of i-cycles of g).
//
// A term is a cycle type, held as the exponents of x_1, x_2, …; a group is the count of its elements
// of each type, over its order. The cyclic, dihedral, symmetric and alternating groups are summed
// by closed formulas, not by listing their elements, so S_n costs the partitions of n.

/** The elements of each cycle type: key is the exponents of x_1 … x_degree, joined by commas. */
export interface CycleIndex {
  readonly degree: number;
  readonly order: bigint;
  readonly types: ReadonlyMap<string, { readonly exponents: readonly number[]; readonly count: bigint }>;
}

/** Most points a cycle index is built for: the sums are over the partitions of n (p(40) ≈ 37 000). */
export const MAX_SYMMETRIC_DEGREE = 40;
export const MAX_CYCLIC_DEGREE = 1000;

class Types {
  readonly types = new Map<string, { exponents: number[]; count: bigint }>();
  constructor(readonly degree: number) {}
  add(parts: ReadonlyMap<number, number> | readonly [number, number][], count: bigint): void {
    const exponents = Array<number>(this.degree).fill(0);
    for (const [length, times] of parts) exponents[length - 1] += times;
    const key = exponents.join(",");
    const known = this.types.get(key);
    if (known === undefined) this.types.set(key, { exponents, count });
    else known.count += count;
  }
  done(order: bigint): CycleIndex {
    return { degree: this.degree, order, types: this.types };
  }
}

const factorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * factorial(n - 1));

function divisorsWithTotient(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let d = 1; d <= n; d++) {
    if (n % d !== 0) continue;
    let phi = 0;
    for (let i = 1; i <= d; i++) if (gcd(i, d) === 1) phi++;
    out.push([d, phi]);
  }
  return out;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** The rotations of an n-gon on n points: φ(d) of them have n/d cycles of length d. */
function addRotations(into: Types, n: number): void {
  for (const [d, phi] of divisorsWithTotient(n)) into.add([[d, n / d]], BigInt(phi));
}

/** C_n acting on n points by rotation. */
export function cyclicIndex(n: number): CycleIndex | undefined {
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CYCLIC_DEGREE) return undefined;
  const types = new Types(n);
  addRotations(types, n);
  return types.done(BigInt(n));
}

/**
 * D_n, the symmetries of an n-gon, on its n vertices. Degenerate n are Wolfram's: D_1 swaps two points,
 * D_2 is the Klein four-group on four points ({1, 2}, {3, 4} flipped independently).
 */
export function dihedralIndex(n: number): CycleIndex | undefined {
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CYCLIC_DEGREE) return undefined;
  if (n === 1) {
    const types = new Types(2);
    types.add([[1, 2]], 1n);
    types.add([[2, 1]], 1n);
    return types.done(2n);
  }
  if (n === 2) {
    const types = new Types(4);
    types.add([[1, 4]], 1n);
    types.add(
      [
        [1, 2],
        [2, 1],
      ],
      2n,
    );
    types.add([[2, 2]], 1n);
    return types.done(4n);
  }
  const types = new Types(n);
  addRotations(types, n);
  // Odd n: every axis fixes one vertex. Even n: half the axes fix two vertices, half none.
  if (n % 2 === 1)
    types.add(
      [
        [1, 1],
        [2, (n - 1) / 2],
      ],
      BigInt(n),
    );
  else {
    types.add(
      [
        [1, 2],
        [2, n / 2 - 1],
      ],
      BigInt(n / 2),
    );
    types.add([[2, n / 2]], BigInt(n / 2));
  }
  return types.done(BigInt(2 * n));
}

/** Cycle types of S_n by multiplicity: the exponent lists of x_1 … x_n with Σ i·m_i = n. */
function* multiplicities(n: number, from = 1): Generator<[number, number][]> {
  if (n === 0) {
    yield [];
    return;
  }
  if (from > n) return;
  for (let times = 0; times * from <= n; times++)
    for (const tail of multiplicities(n - times * from, from + 1)) yield times === 0 ? tail : [[from, times], ...tail];
}

/** S_n on n points; `even` keeps the even permutations only, which is A_n. */
function symmetricLike(n: number, even: boolean): CycleIndex | undefined {
  if (!Number.isSafeInteger(n) || n < 0 || n > MAX_SYMMETRIC_DEGREE) return undefined;
  const types = new Types(n);
  const all = factorial(n);
  let order = 0n;
  for (const parts of multiplicities(n)) {
    const cycles = parts.reduce((sum, [, times]) => sum + times, 0);
    if (even && n > 1 && (n - cycles) % 2 !== 0) continue;
    // n! / Π i^m_i m_i! permutations have this type.
    const count = parts.reduce(
      (left, [length, times]) => left / (BigInt(length) ** BigInt(times) * factorial(times)),
      all,
    );
    types.add(parts, count);
    order += count;
  }
  return types.done(order);
}

export const symmetricIndex = (n: number): CycleIndex | undefined => symmetricLike(n, false);
export const alternatingIndex = (n: number): CycleIndex | undefined => symmetricLike(n, true);

/** The group listed element by element, each a one-line word of the same degree. */
export function listedIndex(elements: readonly (readonly number[])[], degree: number): CycleIndex {
  const types = new Types(degree);
  for (const word of elements) {
    const seen = new Set<number>();
    const lengths = new Map<number, number>();
    for (let start = 1; start <= degree; start++) {
      if (seen.has(start)) continue;
      let length = 0;
      for (let at = start; !seen.has(at); at = word[at - 1]!) {
        seen.add(at);
        length++;
      }
      lengths.set(length, (lengths.get(length) ?? 0) + 1);
    }
    types.add(lengths, 1n);
  }
  return types.done(BigInt(elements.length));
}
