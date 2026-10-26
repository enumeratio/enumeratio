// Independent readings of the integer-partition statistics adopted from FindStat, written
// against the Young diagram and the multiset of parts rather than against the expressions.
//
// A partition is its parts in weakly decreasing order.

export type Partition = readonly number[];

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);
const product = (a: readonly number[]): number => a.reduce((x, y) => x * y, 1);
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number): number => (a * b) / gcd(a, b);
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
const largestEven = (l: Partition): number => Math.max(0, ...l.filter((p) => p % 2 === 0));

/** Column lengths: the conjugate partition. */
const conjugate = (l: Partition): number[] =>
  Array.from({ length: l[0] ?? 0 }, (_, k) => l.filter((p) => p >= k + 1).length);

/** The sums of the sub-multisets of the parts, the empty one excluded. */
const subsetSums = (l: Partition): Set<number> => {
  let sums = new Set([0]);
  for (const p of l) sums = new Set([...sums, ...[...sums].map((s) => s + p)]);
  sums.delete(0);
  return sums;
};

/** Arm and leg of every cell. */
const cells = (l: Partition): { arm: number; leg: number }[] => {
  const c = conjugate(l);
  return l.flatMap((part, i) => Array.from({ length: part }, (_, k) => ({ arm: part - k - 1, leg: c[k]! - i - 1 })));
};

const binomial = (n: number, k: number): number => {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j;
  return r;
};
/** Parts to a permutation of 1..n with those cycle lengths: p[i] is the image of i. */
const permutationOfCycleType = (l: Partition): number[] => {
  const p: number[] = [];
  let start = 0;
  for (const length of l) {
    for (let k = 0; k < length; k++) p[start + k] = start + ((k + 1) % length);
    start += length;
  }
  return p;
};
/** The subsets of 0..n-1 of the given size (any size when omitted), as bitmasks. */
const subsetMasks = (n: number, size?: number): number[] => {
  const out: number[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let bits = 0;
    for (let b = 0; b < n; b++) bits += (mask >> b) & 1;
    if (size === undefined || bits === size) out.push(mask);
  }
  return out;
};
const invariantSubsets = (l: Partition, size?: number): number => {
  const p = permutationOfCycleType(l);
  const n = p.length;
  return subsetMasks(n, size).filter((mask) => p.every((image, i) => ((mask >> i) & 1) === ((mask >> image) & 1)))
    .length;
};
/** Subset-sum differences: |sum(S) - sum(rest)| over every split of the parts. */
const splitDifferences = (l: Partition): number[] => {
  const n = sum(l);
  return subsetMasks(l.length).map((mask) => Math.abs(n - 2 * sum(l.filter((_, i) => (mask >> i) & 1))));
};
/** Partitions mu with l[i] >= mu[i] >= l[i+1] (the part after the last is 0), counted by walking the choices. */
const interlacing = (l: Partition, i = 0): number => {
  if (i === l.length) return 1;
  let total = 0;
  for (let m = l[i + 1] ?? 0; m <= l[i]!; m++) total += interlacing(l, i + 1);
  return total;
};
/** The number of ways to deal the points 1..n into blocks of these sizes, in order. */
const orderedBlocks = (l: Partition): number => {
  let left = sum(l);
  let ways = 1;
  for (const part of l) {
    ways *= binomial(left, part);
    left -= part;
  }
  return ways;
};
const multiplicities = (l: Partition): number[] => [...new Set(l)].map((part) => l.filter((q) => q === part).length);
/** e_m at k ones: the coefficient of t^m in (1 + t)^k, multiplying the polynomial in one factor at a time. */
const elementaryAtOnes = (k: number, m: number): number => {
  let poly = [1, ...Array<number>(m).fill(0)];
  for (let v = 0; v < k; v++) poly = poly.map((c, d) => c + (poly[d - 1] ?? 0));
  return poly[m]!;
};
// ── Fourth round ─────────────────────────────────────────────────────────────────────────

const bigFactorial = (n: number): bigint => (n <= 1 ? 1n : BigInt(n) * bigFactorial(n - 1));
const bigProduct = (a: readonly bigint[]): bigint => a.reduce((x, y) => x * y, 1n);

/** The number of semistandard tableaux of the shape with entries at most k: Weyl's dimension formula for GL_k, the shape padded with zeros. */
const weylDimension = (l: Partition, k: number): number => {
  if (l.length > k) return 0;
  const w = [...l, ...Array<number>(k - l.length).fill(0)];
  let top = 1n;
  let bottom = 1n;
  for (let i = 0; i < k; i++)
    for (let j = i + 1; j < k; j++) {
      top *= BigInt(w[i]! - w[j]! + j - i);
      bottom *= BigInt(j - i);
    }
  return Number(top / bottom);
};
/** The number of standard tableaux, by removing a corner in every way: the sum over the shapes one cell smaller. */
const standardMemo = new Map<string, number>();
const standardTableaux = (l: Partition): number => {
  if (l.length === 0) return 1;
  const key = l.join(",");
  const known = standardMemo.get(key);
  if (known !== undefined) return known;
  let total = 0;
  for (let i = 0; i < l.length; i++) {
    if (l[i]! === (l[i + 1] ?? 0)) continue;
    total += standardTableaux(l.map((p, r) => (r === i ? p - 1 : p)).filter((p) => p > 0));
  }
  standardMemo.set(key, total);
  return total;
};
/** Standard tableaux of the shifted shape of a strict partition, by removing a corner in every way; 0 unless the parts are distinct. */
const shiftedMemo = new Map<string, number>();
const shiftedStandardTableaux = (l: Partition): number => {
  if (l.some((p, i) => i > 0 && p === l[i - 1])) return 0;
  if (l.length === 0) return 1;
  const key = l.join(",");
  const known = shiftedMemo.get(key);
  if (known !== undefined) return known;
  let total = 0;
  for (let i = 0; i < l.length; i++) {
    if (i + 1 < l.length && l[i]! - 1 === l[i + 1]!) continue;
    total += shiftedStandardTableaux(l.map((p, r) => (r === i ? p - 1 : p)).filter((p) => p > 0));
  }
  shiftedMemo.set(key, total);
  return total;
};
/** Over every standard tableau: the count, the sum of the major indices and the sum of their squares. Entries are placed one at a time; i is a descent when i + 1 lands in a lower row. */
interface Moments {
  count: bigint;
  sum: bigint;
  squares: bigint;
}
const majorIndexMemo = new Map<string, Moments>();
const majorIndexMoments = (l: Partition): Moments => {
  const key = l.join(",");
  const known = majorIndexMemo.get(key);
  if (known) return known;
  const moments: Moments = { count: 0n, sum: 0n, squares: 0n };
  const n = sum(l);
  const shape = l.map(() => 0);
  const walk = (placed: number, lastRow: number, major: number): void => {
    if (placed === n) {
      moments.count += 1n;
      moments.sum += BigInt(major);
      moments.squares += BigInt(major * major);
      return;
    }
    for (let row = 0; row < l.length; row++) {
      if (shape[row]! >= l[row]! || (row > 0 && shape[row]! >= shape[row - 1]!)) continue;
      shape[row]!++;
      walk(placed + 1, row, major + (placed > 0 && row > lastRow ? placed : 0));
      shape[row]!--;
    }
  };
  walk(0, 0, 0);
  majorIndexMemo.set(key, moments);
  return moments;
};
/** The degree of the polynomial prod over pairs i < j of (k (l_j - l_i) + j - i)/(j - i), multiplied out in k. */
const stretchedDegree = (l: Partition): number => {
  let poly = [1];
  for (let j = 0; j < l.length; j++)
    for (let i = 0; i < j; i++) {
      const [slope, constant] = [l[j]! - l[i]!, j - i];
      const next = Array<number>(poly.length + 1).fill(0);
      poly.forEach((c, d) => {
        next[d]! += c * constant;
        next[d + 1]! += c * slope;
      });
      poly = next;
    }
  while (poly.length > 1 && poly.at(-1) === 0) poly.pop();
  return poly.length - 1;
};
/** The border-strip decomposition, as FindStat steps it: drop the first part and take one off each of the rest. */
const borderStrips = (l: Partition): Partition[] => {
  const strips: Partition[] = [];
  for (
    let current = l;
    current.length > 0;
    current = current
      .slice(1)
      .filter((p) => p > 1)
      .map((p) => p - 1)
  )
    strips.push(current);
  return strips;
};
/** The k-rim hooks removed to reach the k-core: slide a bead of the abacus back k places while that place is free. */
const rimHooksToCore = (l: Partition, k: number): number => {
  const beads = new Set(l.map((p, i) => p + l.length - 1 - i));
  let moved = 0;
  for (let again = true; again;) {
    again = false;
    for (const bead of [...beads].toSorted((a, b) => a - b)) {
      if (bead >= k && !beads.has(bead - k)) {
        beads.delete(bead);
        beads.add(bead - k);
        moved++;
        again = true;
      }
    }
  }
  return moved;
};
/** The number of partitions of n with parts at most m. */
const partitionsMemo = new Map<string, number>();
const partitionCount = (n: number, m = n): number => {
  if (n === 0) return 1;
  if (m === 0) return 0;
  const key = `${n},${m}`;
  const known = partitionsMemo.get(key);
  if (known !== undefined) return known;
  const total = partitionCount(n, m - 1) + (m <= n ? partitionCount(n - m, m) : 0);
  partitionsMemo.set(key, total);
  return total;
};
/** z_l: the size of the centralizer of a permutation of this cycle type. */
const centralizerOf = (l: Partition): number =>
  product(
    [...new Set(l)].map((j) => j ** l.filter((p) => p === j).length * factorial(l.filter((p) => p === j).length)),
  );
/** Compose permutations of 0..n-1 given as image arrays: first `p`, then `q`. */
const compose = (p: readonly number[], q: readonly number[]): number[] => p.map((image) => q[image]!);
/**
 * The tuples of `length` transpositions (a, b), a < b, with b weakly increasing, that connect every point and whose product is the
 * permutation of this cycle type.
 */
const transitiveMonotoneFactorizations = (l: Partition, length: number): number => {
  const n = sum(l);
  const identity = Array.from({ length: n }, (_, i) => i);
  let found = 0;
  const walk = (left: number, atLeast: number, current: number[], edges: [number, number][]): void => {
    if (left === 0) {
      if (!current.every((image, i) => image === identity[i])) return;
      const reach = new Set([0]);
      for (let again = true; again;) {
        again = false;
        for (const [a, b] of edges)
          if (reach.has(a) !== reach.has(b)) {
            reach.add(a).add(b);
            again = true;
          }
      }
      if (reach.size === n) found++;
      return;
    }
    for (let b = atLeast; b < n; b++)
      for (let a = 0; a < b; a++) {
        const swap = identity.map((i) => (i === a ? b : i === b ? a : i));
        walk(left - 1, b, compose(swap, current), [...edges, [a, b]]);
      }
  };
  walk(length, 1, permutationOfCycleType(l), []);
  return found;
};
/** Every partition contained in this one (rows weakly decreasing, each at most the shape's row), the empty one included. */
const subpartitionMemo = new Map<string, number[][]>();
const subpartitions = (l: Partition): number[][] => {
  const key = l.join(",");
  const known = subpartitionMemo.get(key);
  if (known) return known;
  const out: number[][] = [];
  const walk = (row: number, cap: number, chosen: number[]): void => {
    if (row === l.length) {
      out.push(chosen.filter((p) => p > 0));
      return;
    }
    for (let size = 0; size <= Math.min(cap, l[row]!); size++) walk(row + 1, size, [...chosen, size]);
  };
  walk(0, l[0] ?? 0, []);
  subpartitionMemo.set(key, out);
  return out;
};
/**
 * The standard tableaux of the skew shape nu / l, where nu has one more cell in every column of l and a cell in each of the
 * columns up to n: FindStat's construction. Cells are filled in any order that has the cell to the left and the one above
 * (when they are in the skew shape) filled first, counted over the sets of filled cells.
 */
const borderSkewTableaux = (l: Partition): number => {
  const n = sum(l);
  const columns = conjugate(l);
  const cellsOfSkew: [number, number][] = [];
  for (let c = 0; c < n; c++) cellsOfSkew.push([columns[c] ?? 0, c]);
  const index = new Map(cellsOfSkew.map(([r, c], i) => [`${r},${c}`, i]));
  const before = cellsOfSkew.map(
    ([r, c]) => [index.get(`${r},${c - 1}`), index.get(`${r - 1},${c}`)].filter((i) => i !== undefined) as number[],
  );
  const full = (1 << n) - 1;
  const ways = new Map<number, number>([[full, 1]]);
  const completions = (mask: number): number => {
    const known = ways.get(mask);
    if (known !== undefined) return known;
    let total = 0;
    for (let i = 0; i < n; i++)
      if (!((mask >> i) & 1) && before[i]!.every((j) => (mask >> j) & 1)) total += completions(mask | (1 << i));
    ways.set(mask, total);
    return total;
  };
  return completions(0);
};
/** Weyl's dimension formula for a symplectic group, in fundamental-weight coordinates: the product over the positive coroots c of (c . (a + 1)) over (c . 1). The partition is the highest weight in the orthogonal basis. */
const symplecticDimension = (l: Partition, coroots: readonly (readonly number[])[]): number => {
  const rank = coroots[0]!.length;
  if (l.length > rank) return 0;
  const parts = [...l, ...Array<number>(rank - l.length).fill(0)];
  const shifted = parts.map((p, i) => p - (parts[i + 1] ?? 0) + 1);
  const dot = (c: readonly number[], v: readonly number[]) => sum(c.map((x, i) => x * v[i]!));
  const ones = Array<number>(rank).fill(1);
  return Math.round(product(coroots.map((c) => dot(c, shifted))) / product(coroots.map((c) => dot(c, ones))));
};
const COROOTS_C2 = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, 2],
];
const COROOTS_C3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
  [1, 1, 0],
  [0, 1, 1],
  [1, 1, 1],
  [0, 1, 2],
  [1, 1, 2],
  [1, 2, 2],
];
/** FindStat's formula for the transitive monotone factorizations: the monotone Hurwitz number over the size of the conjugacy class. */
const monotoneHurwitz = (l: Partition): number => {
  const [n, c] = [sum(l), l.length];
  const classSize = bigFactorial(n) / BigInt(centralizerOf(l));
  let top =
    (bigFactorial(n) / bigProduct(multiplicities(l).map((m) => bigFactorial(m)))) *
    bigProduct(l.map((p) => bigFactorial(2 * p) / (bigFactorial(p) * bigFactorial(p))));
  let bottom = 1n;
  const k = c - 3;
  if (k >= 0) for (let j = 0; j < k; j++) top *= BigInt(2 * n + 1 + j);
  else for (let j = 0; j < -k; j++) bottom *= BigInt(2 * n + k + 1 + j);
  return Number(top / bottom / classSize);
};
/** Factorizations are tried by brute force up to this size, and by FindStat's formula past it. */
const BRUTE_FORCE_SIZE = 5;
/** The transitive tuples of `length` star transpositions (0, a), those that between them touch every point, whose product is the permutation of this cycle type. */
const starFactorizations = (l: Partition, length: number): number => {
  const n = sum(l);
  const identity = Array.from({ length: n }, (_, i) => i);
  const walk = (left: number, current: number[], used: number): number => {
    if (left === 0) return used === (1 << n) - 2 && current.every((image, i) => image === identity[i]) ? 1 : 0;
    let total = 0;
    for (let a = 1; a < n; a++)
      total += walk(
        left - 1,
        compose(
          identity.map((i) => (i === 0 ? a : i === a ? 0 : i)),
          current,
        ),
        used | (1 << a),
      );
    return total;
  };
  return walk(length, permutationOfCycleType(l), 0);
};

export const PARTITION_READINGS: Record<string, (l: Partition) => number> = {
  PartRange: (l) => (l.length === 0 ? 0 : l[0]! - l.at(-1)!),
  ContainingRectangleShortSide: (l) => (l.length === 0 ? 0 : Math.min(l[0]!, l.length)),
  MaximalRectangleHalfPerimeter: (l) => Math.max(0, ...l.map((p, i) => p + i + 1)),
  LargestShiftedPart: (l) => Math.max(0, ...l.map((p, i) => p + i)),
  RemovableHorizontalDominoes: (l) => l.filter((p, i) => p - 2 >= (l[i + 1] ?? 0)).length,
  CellsOutsideFirstRow: (l) => (l.length === 0 ? 0 : sum(l) - l[0]!),
  CellsOutsideFirstHook: (l) => (l.length === 0 ? 0 : sum(l) - (l[0]! + l.length - 1)),
  RowCellPairs: (l) => sum(l.map((p) => (p * (p - 1)) / 2)),
  CellsWithZeroLegAndOddArm: (l) => cells(l).filter((cell) => cell.leg === 0 && cell.arm % 2 === 1).length,
  // Corners counted from the bottom row, which is position 1.
  CornerMajorIndex: (l) => sum(l.map((p, i) => (p > (l[i + 1] ?? 0) ? l.length - i + p - 1 : 0))),
  PartProduct: (l) => product(l),
  PartSquareSum: (l) => sum(l.map((p) => p * p)),
  PartFactorialProduct: (l) => product(l.map(factorial)),
  MultiplicityFactorialProduct: (l) =>
    product([...new Set(l)].map((part) => factorial(l.filter((p) => p === part).length))),
  SumOfEvenParts: (l) => sum(l.filter((p) => p % 2 === 0)),
  SumOfOddParts: (l) => sum(l.filter((p) => p % 2 === 1)),
  SumOfPartsAtLeastTwo: (l) => sum(l.filter((p) => p >= 2)),
  GreatestCommonDivisorOfParts: (l) => l.reduce(gcd, 0),
  LeastCommonMultipleOfParts: (l) => l.reduce(lcm, 1),
  PairwiseGreatestCommonDivisorSum: (l) => sum(l.flatMap((p, i) => l.slice(i + 1).map((q) => gcd(p, q)))),
  LargestEvenPart: largestEven,
  EvenOddCrank: (l) => largestEven(l) - l.filter((p) => p % 2 === 1).length,
  OddPartsBelowLargestEvenPart: (l) => l.filter((p) => p % 2 === 1 && p < largestEven(l)).length,
  DistinctEvenParts: (l) => new Set(l.filter((p) => p % 2 === 0)).size,
  // Row 0 counts +, row 1 counts -, and so on: a checkerboard filling summed over the diagram.
  BerkovichGarvanRank: (l) => sum(l.map((p, i) => (i % 2 === 0 ? 1 : -1) * (p % 2))),
  PartsEqualToNextPart: (l) => l.length - new Set(l).size,
  LargestMissingPart: (l) => {
    if (l.length === 0) return 0;
    let k = l[0]! - 1;
    while (l.includes(k)) k--;
    return k;
  },
  SmallestNonRepeatedInteger: (l) => {
    let k = 1;
    while (l.filter((p) => p === k).length >= 2) k++;
    return k;
  },
  DistinctSubsetSums: (l) => subsetSums(l).size,
  DistinctEvenSubsetSums: (l) => [...subsetSums(l)].filter((s) => s % 2 === 0).length,
  DistinctOddSubsetSums: (l) => [...subsetSums(l)].filter((s) => s % 2 === 1).length,
  PartsNotCongruentToTwoModuloThree: (l) => l.filter((p) => p % 3 !== 2).length,
  PartsNotCongruentToZeroModuloThree: (l) => l.filter((p) => p % 3 !== 0).length,
  PartsNotCongruentToOneModuloThree: (l) => l.filter((p) => p % 3 !== 1).length,
  PartsEqualTwo: (l) => l.filter((p) => p === 2).length,
  HalfSumOfEvenParts: (l) => sum(l.filter((p) => p % 2 === 0)) / 2,
  HalfLargestEvenPart: (l) => largestEven(l) / 2,
  DistinctOddPartsBelowLargestEvenPart: (l) => new Set(l.filter((p) => p % 2 === 1 && p < largestEven(l))).size,
  PartSquareProduct: (l) => product(l.map((p) => p * p)),
  // Choose the parts one after another from what is left of the size.
  MultinomialOfParts: (l) => orderedBlocks(l),
  ExponensConsonantiae: (l) => (l.length === 0 ? 0 : l.reduce(lcm, 1) / l.reduce(gcd, 0)),
  CyclicSievingPolynomialDegree: (l) => (l.length === 0 ? 0 : l.reduce(lcm, 1) - l.reduce(lcm, 1) / l[0]!),
  GiniIndex: (l) => binomial(sum(l) + 1, 2) - sum(conjugate(l).map((c) => binomial(c + 1, 2))),
  InterlacingPartitionCount: (l) => interlacing(l),
  MinimalSubpartitionSizeDifference: (l) => Math.min(...splitDifferences(l)),
  // `+ 0` turns a -0 from a negative factor times 0 into 0.
  AlladiWeight: (l) => (l.length === 0 ? 0 : l.at(-1)! * product(l.slice(0, -1).map((p, i) => p - l[i + 1]! - 1))) + 0,
  SecondAlladiWeight: (l) => {
    if (l.length === 0) return 0;
    const delta = (p: number) => (p % 2 === 0 ? 1 : 0);
    const last = l.at(-1)!;
    return (
      ((last + 1 - delta(last)) / 2) *
        product(l.slice(0, -1).map((p, i) => (p - l[i + 1]! - delta(p) - delta(l[i + 1]!)) / 2)) +
      0
    );
  },
  // z = the product over part sizes j of j^m_j m_j!.
  CentralizerSize: (l) =>
    product(
      [...new Set(l)].map((j) => j ** l.filter((p) => p === j).length * factorial(l.filter((p) => p === j).length)),
    ),
  // n! over z, the size of the conjugacy class of the cycle type.
  ConjugacyClassSize: (l) => factorial(sum(l)) / PARTITION_READINGS.CentralizerSize!(l),
  SetPartitionsWithBlockSizesCount: (l) => orderedBlocks(l) / product(multiplicities(l).map(factorial)),
  // FindStat's formula: the multinomial (n + 1 - k; m_1, ..., m_n) over n + 1.
  KrewerasNumber: (l) => {
    const n = sum(l);
    return factorial(n + 1) / (factorial(n + 1 - l.length) * product(multiplicities(l).map(factorial)) * (n + 1));
  },
  InvariantSubsetCount: (l) => invariantSubsets(l),
  InvariantTwoElementSubsetCount: (l) => invariantSubsets(l, 2),
  InvariantThreeElementSubsetCount: (l) => invariantSubsets(l, 3),
  // Union the edges a permutation of this cycle type carries onto one another.
  EdgeOrbitCount: (l) => {
    const p = permutationOfCycleType(l);
    const n = p.length;
    const seen = new Set<number>();
    let orbits = 0;
    for (let a = 0; a < n; a++)
      for (let b = a + 1; b < n; b++) {
        if (seen.has(a * n + b)) continue;
        orbits++;
        let [u, v] = [a, b];
        while (!seen.has(Math.min(u, v) * n + Math.max(u, v))) {
          seen.add(Math.min(u, v) * n + Math.max(u, v));
          [u, v] = [p[u]!, p[v]!];
        }
      }
    return orbits;
  },
  ElementarySymmetricFunctionAtOne: (l) => product(l.map((p) => elementaryAtOnes(l.length, p))),
  SubsetGreatestCommonDivisorSum: (l) =>
    l.length === 0 ? 0 : sum(subsetMasks(l.length).map((mask) => l.filter((_, i) => (mask >> i) & 1).reduce(gcd, 0))),

  // ── Fourth round ───────────────────────────────────────────────────────────────────────
  SemistandardTableauCountWithEntriesUpToTwo: (l) => weylDimension(l, 2),
  SemistandardTableauCountWithEntriesUpToThree: (l) => weylDimension(l, 3),
  SemistandardTableauCountWithEntriesUpToFour: (l) => weylDimension(l, 4),
  SemistandardTableauCountWithEntriesUpToLength: (l) => weylDimension(l, l.length),
  SemistandardTableauCountWithEntriesUpToSize: (l) => weylDimension(l, sum(l)),
  PlancherelCount: (l) => standardTableaux(l) ** 2,
  CubedStandardTableauCount: (l) => standardTableaux(l) ** 3,
  ShiftedStandardTableauCount: shiftedStandardTableaux,
  TwiceMeanMajorIndexOfStandardTableaux: (l) => {
    const { count, sum: total } = majorIndexMoments(l);
    return Number((2n * total) / count);
  },
  TwelveTimesMajorIndexVarianceOfStandardTableaux: (l) => {
    const { count, sum: total, squares } = majorIndexMoments(l);
    return Number((12n * (squares * count - total * total)) / (count * count));
  },
  PairsOfDistinctParts: stretchedDegree,
  // The spin: the crossings of each border strip, as FindStat sums them (the differences of its parts with a 1 on the end).
  DiagonalArmSum: (l) =>
    sum(
      borderStrips(l).map((strip) => {
        const padded = [...strip, 1];
        return sum(padded.slice(1).map((p, i) => padded[i]! - p));
      }),
    ),
  RimHooksRemovedToTwoCore: (l) => rimHooksToCore(l, 2),
  RimHooksRemovedToThreeCore: (l) => rimHooksToCore(l, 3),
  MultipartitionCount: (l) => product(l.map((p) => partitionCount(p))),
  // The chain of binomials that deals the points into blocks in order, over the arrangements of the equal ones.
  PartRearrangementCount: (l) => {
    let [left, ways] = [l.length, 1];
    for (const m of multiplicities(l)) {
      ways *= binomial(left, m);
      left -= m;
    }
    return ways;
  },
  // The coefficient reads as the set partitions of the block sizes arranged in a cycle: (length - 1)! of them each.
  LogarithmicDerivativeCoefficient: (l) =>
    l.length === 0 ? 1 : (orderedBlocks(l) / product(multiplicities(l).map(factorial))) * factorial(l.length - 1),
  LagrangeInversionCoefficient: (l) =>
    l.length === 0
      ? 1
      : Number(bigFactorial(sum(l) + l.length - 2) / bigFactorial(sum(l) - 1)) /
        product(multiplicities(l).map(factorial)),
  StarTranspositionFactorizationCount: (l) => {
    const [n, r] = [sum(l), sum(l) + l.length - 2];
    if (l.length === 0) return 1;
    return n <= BRUTE_FORCE_SIZE
      ? starFactorizations(l, r)
      : Number((bigFactorial(r) * BigInt(product(l))) / bigFactorial(n));
  },
  TransitiveMonotoneFactorizationCount: (l) =>
    l.length === 0
      ? 1
      : sum(l) <= BRUTE_FORCE_SIZE
        ? transitiveMonotoneFactorizations(l, sum(l) + l.length - 2)
        : monotoneHurwitz(l),
  SymplecticDimensionRankTwo: (l) => symplecticDimension(l, COROOTS_C2),
  SymplecticDimensionRankThree: (l) => symplecticDimension(l, COROOTS_C3),
  BorderSkewStandardTableauCount: borderSkewTableaux,
  SubpartitionCount: (l) => subpartitions(l).length,
  SameLengthSubpartitionCount: (l) => subpartitions(l).filter((mu) => mu.length === l.length).length,
  // A covering relation is a partition and one of its corners removed: the corners are the distinct nonzero parts.
  YoungLatticeCoveringRelationCount: (l) => sum(subpartitions(l).map((mu) => new Set(mu).size)),

  // The fifth batch.
  PartCount: (l) => l.length,
  LengthCrank: (l) => {
    const ones = l.filter((p) => p === 1).length;
    return ones === 0 ? l.length : l.filter((p) => p > ones).length - ones;
  },
};
