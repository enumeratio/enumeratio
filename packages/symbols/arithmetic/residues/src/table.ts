// ℤ/n's addition and multiplication tables as layers to draw: cell (i, j) holds aᵢ + aⱼ or aᵢ·aⱼ
// mod n, row i going down and column j across, the elements aᵢ listed in natural order, by their
// Chinese remainders, or by their p-adic digits. Each answers what a `Show`'s rules ask of it —
// properties of its value (`IsUnit`, `IsIdempotent`, `IsSquare`), values (`Value`, `Row`,
// `Column`, `Difference`, `Order`, `Valuation`, `Digit(k)`) and relations to a selected cell
// (`SameValue`, `SquareRoots`, `Associates`, `Multiples`, `Lifts`, `SameResidue`, `Congruent(m)`).
//
// Plenty shows at a glance: the units form a Latin square, the idempotents line up with the
// factors of n (the Chinese remainder theorem), and a 1 at (x, x − k) says x(x − k) = 1: x is a
// root of x² − kx − 1, a "metallic mean" of ℤ/n, read off the diagonal where Difference ≡ −k.
// Listed by digits, ℤ/pᵏ's table is p × p blocks of ℤ/pᵏ⁻¹'s, each block the lifts of one cell.

type Vec2 = readonly [number, number];

/** The largest modulus a table answers, so i·j stays exact in a double. */
export const MAX_MODULUS = 1 << 24;

const gcd = (a: number, b: number): number => {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y) [x, y] = [y, x % y];
  return x;
};

/** The product of n's distinct primes: v is nilpotent mod n exactly when it divides v. */
function radical(n: number): number {
  let r = 1;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    r *= p;
    while (m % p === 0) m /= p;
  }
  return m > 1 ? r * m : r;
}

export const TABLE_PROPERTIES = [
  "IsZero",
  "IsOne",
  "IsMinusOne",
  "IsUnit",
  "IsZeroDivisor",
  "IsIdempotent",
  "IsNilpotent",
  "IsSquare",
  "IsInvolution",
  "IsDiagonal",
] as const;
export const TABLE_VALUES = [
  "Value",
  "Row",
  "Column",
  "Difference",
  "Order",
  "Modulus",
  "Valuation",
  "Digit(k)",
] as const;
export const TABLE_RELATIONS = [
  "SameValue",
  "SquareRoots",
  "SameRow",
  "SameColumn",
  "Associates",
  "Multiples",
  "Lifts",
  "SameResidue",
  "Congruent(m)",
] as const;

/** The ring operation a table tabulates. */
export type TableOperation = "Add" | "Multiply";

/**
 * How a table lists ℤ/n's elements along its rows and columns:
 * - `Natural`: 0, 1, …, n − 1.
 * - `ChineseRemainder`: by their residues modulo each prime power of n, smallest first, so
 *   ℤ/15's table is ℤ/3's with ℤ/5's in each cell.
 * - `Adic`: as `ChineseRemainder`, each prime power's residue read by its base-p digits, the
 *   lowest first. ℤ/pᵏ's elements then go by their residue mod p, then mod p², …, so its table
 *   is p × p blocks of ℤ/pᵏ⁻¹'s, each block the lifts of one of its cells.
 */
export type ElementOrder = "Natural" | "ChineseRemainder" | "Adic";

/** n's prime powers, smallest prime first, each with its prime. */
function primePowers(n: number): { p: number; q: number }[] {
  const out: { p: number; q: number }[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    let q = 1;
    while (m % p === 0) {
      m /= p;
      q *= p;
    }
    out.push({ p, q });
  }
  if (m > 1) out.push({ p: m, q: m });
  return out;
}

/** ℤ/n's elements, 0 … n − 1, in the order `listing` lists them. */
export function tableElements(n: number, listing: ElementOrder = "Natural"): number[] {
  const powers = primePowers(n);
  const elements = [...Array(n).keys()];
  if (listing === "Natural") return elements;
  // Each residue a mod q as its sort key: itself, or its base-p digits, the lowest first.
  const key = (a: number, { p, q }: { p: number; q: number }): number[] => {
    if (listing === "ChineseRemainder") return [a % q];
    const digits: number[] = [];
    for (let x = a % q, w = 1; w < q; w *= p, x = Math.floor(x / p)) digits.push(x % p);
    return digits;
  };
  const keys = new Map(elements.map((a) => [a, powers.flatMap((pq) => key(a, pq))] as const));
  return elements.toSorted((a, b) => {
    const [ka, kb] = [keys.get(a)!, keys.get(b)!];
    for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return ka[k]! - kb[k]!;
    return 0;
  });
}

/** a ∘ b mod n, for the table's operation. */
export const combine = (operation: TableOperation, a: number, b: number, n: number): number =>
  operation === "Add" ? (a + b) % n : (a * b) % n;

/** The exponent of p in v as an element of ℤ/n: for 0, the exponent of p in n. */
function valuation(v: number, p: number, n: number): number {
  if (v === 0) {
    let k = 0;
    for (let q = 1; q < n && n % (q * p) === 0; q *= p) k++;
    return k;
  }
  let k = 0;
  for (let x = v; x % p === 0; x /= p) k++;
  return k;
}

export interface ResidueTable {
  readonly title: string;
  readonly modulus: number;
  readonly basis: readonly [Vec2, Vec2];
  readonly maxIndex: number;
  /** The cells there are: rows and columns 0 … n − 1. */
  readonly bounds: { readonly i: Vec2; readonly j: Vec2 };
  readonly grid: readonly [Vec2, Vec2];
  /** The grid `GridLines -> Automatic` draws: around the Chinese remainder blocks, when listed by them. */
  readonly autoGrid?: readonly [number, number];
  /** Grid lines run between cells, half a cell off the lattice of their centers. */
  readonly gridOffset: readonly [number, number];
  gridLabel(axis: 0 | 1, k: number): string;
  home(): { center: Vec2; extent: number };
  known(i: number, j: number): boolean;
  prepare(i: number, j: number): void;
  has(i: number, j: number, property: string): boolean | undefined;
  value(i: number, j: number, name: string): number | undefined;
  relatedTo(relation: string, selected: Vec2, i: number, j: number): boolean;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** ℤ/n's multiplication table; undefined for a modulus below 2 or past `MAX_MODULUS`. */
export const multiplicationTable = (n: number, listing: ElementOrder = "Natural"): ResidueTable | undefined =>
  residueTable(n, "Multiply", listing);

/** ℤ/n's addition table; undefined for a modulus below 2 or past `MAX_MODULUS`. */
export const additionTable = (n: number, listing: ElementOrder = "Natural"): ResidueTable | undefined =>
  residueTable(n, "Add", listing);

/** `Congruent(m)`'s modulus, or `Digit(k)`'s place. */
const argumentOf = (name: string, head: string): number | undefined => {
  const match = new RegExp(`^${head}\\((\\d+)\\)$`).exec(name);
  return match ? Number(match[1]) : undefined;
};

function residueTable(n: number, operation: TableOperation, listing: ElementOrder): ResidueTable | undefined {
  if (!Number.isInteger(n) || n < 2 || n > MAX_MODULUS) return undefined;
  const rad = radical(n);
  const powers = primePowers(n);
  // `Valuation` and `Digit(k)` read the smallest prime of n: all of it for ℤ/pᵏ.
  const p = powers[0]!.p;
  const elements = tableElements(n, listing);
  const inside = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < n && j < n;
  const valueAt = (i: number, j: number): number => combine(operation, elements[i]!, elements[j]!, n);
  const symbol = operation === "Add" ? "+" : "·";

  // Facts about each residue, computed once a residue is first asked about.
  const squares = new Uint8Array(n);
  let squaresKnown = false;
  const isSquare = (v: number): boolean => {
    if (!squaresKnown) {
      for (let x = 0; x < n; x++) squares[(x * x) % n] = 1;
      squaresKnown = true;
    }
    return squares[v] === 1;
  };
  const orders = new Map<number, number>();
  /**
   * In the addition table, v's additive order, n / gcd(v, n). In the multiplication table, a
   * unit's multiplicative order, 0 for a non-unit; capped by n, as an order divides φ(n) < n.
   */
  const order = (v: number): number => {
    if (operation === "Add") return n / gcd(v, n);
    if (gcd(v, n) !== 1) return 0;
    let k = orders.get(v);
    if (k === undefined) {
      k = 1;
      for (let p = v % n; p !== 1 % n && k < n; p = (p * v) % n) k++;
      orders.set(v, k);
    }
    return k;
  };

  const property = (i: number, j: number, name: string): boolean | undefined => {
    const v = valueAt(i, j);
    switch (name) {
      case "IsZero":
        return v === 0;
      case "IsOne":
        return v === 1 % n;
      case "IsMinusOne":
        return v === n - 1;
      case "IsUnit":
        return gcd(v, n) === 1;
      case "IsZeroDivisor":
        return v !== 0 && gcd(v, n) !== 1;
      case "IsIdempotent":
        return (v * v) % n === v;
      case "IsNilpotent":
        return v % rad === 0;
      case "IsSquare":
        return isSquare(v);
      case "IsInvolution":
        return (v * v) % n === 1 % n;
      case "IsDiagonal":
        return i === j;
      case "Unknown":
        return false;
    }
    return undefined;
  };

  // The blocks `GridLines -> Automatic` draws round: the first key's, one per residue mod the
  // smallest prime power (or prime, by digits).
  const block =
    listing === "Adic" && n > p ? n / p : listing === "ChineseRemainder" && powers.length > 1 ? n / powers[0]!.q : 0;

  return {
    title: `(ℤ/${n}, ${operation === "Add" ? "+" : "×"})`,
    modulus: n,
    // Row i goes down the page, column j across: (i, j) sits at x = j, y = −i.
    basis: [
      [0, -1],
      [1, 0],
    ],
    maxIndex: n - 1,
    bounds: { i: [0, n - 1], j: [0, n - 1] },
    grid: [
      [1, 0],
      [0, 1],
    ],
    ...(block > 0 ? { autoGrid: [block, block] as const } : {}),
    gridOffset: [-0.5, -0.5],
    gridLabel: (_axis, k) => (k >= 0 && k < n ? String(elements[k]) : ""),
    home: () => ({ center: [(n - 1) / 2, -(n - 1) / 2], extent: (n / 2) * 1.04 }),
    known: () => true,
    prepare: () => {},
    has: (i, j, name) => (inside(i, j) ? property(i, j, name) : undefined),
    value: (i, j, name) => {
      if (!inside(i, j)) return undefined;
      switch (name) {
        case "Value":
          return valueAt(i, j);
        case "Row":
          return elements[i];
        case "Column":
          return elements[j];
        case "Difference":
          return (((elements[j]! - elements[i]!) % n) + n) % n;
        case "Order":
          return order(valueAt(i, j));
        case "Modulus":
          return n;
        case "Valuation":
          return valuation(valueAt(i, j), p, n);
      }
      // `Digit(k)`: the value's k-th base-p digit, k = 1 the lowest.
      const place = argumentOf(name, "Digit");
      return place === undefined || place < 1 ? undefined : Math.floor(valueAt(i, j) / p ** (place - 1)) % p;
    },
    relatedTo: (relation, [si, sj], i, j) => {
      if (!inside(i, j) || !inside(si, sj)) return false;
      const [v, s] = [valueAt(i, j), valueAt(si, sj)];
      switch (relation) {
        case "SameValue":
          return v === s;
        case "SquareRoots":
          return i === j && v === s;
        case "SameRow":
          return i === si;
        case "SameColumn":
          return j === sj;
        // v = u·s for a unit u exactly when they generate the same ideal: gcd(v, n) = gcd(s, n).
        case "Associates":
          return gcd(v, n) === gcd(s, n);
        // v ∈ (s) exactly when gcd(s, n) divides v.
        case "Multiples":
          return v % gcd(s, n) === 0;
        // v ≡ s (mod n/p): in ℤ/pᵏ, the p lifts of s's residue mod pᵏ⁻¹.
        case "Lifts":
          return (v - s) % (n / p) === 0;
        // v ≡ s (mod p): every lift, at every level, of s's residue mod p.
        case "SameResidue":
          return (v - s) % p === 0;
      }
      // `Congruent(m)`: v ≡ s (mod m), m | n; with m = n/p in ℤ/pᵏ, the p lifts of s mod pᵏ⁻¹.
      const m = argumentOf(relation, "Congruent");
      return m !== undefined && m >= 1 && (v - s) % m === 0;
    },
    summary: () => [
      ["modulus", String(n)],
      ["units", String([...Array(n).keys()].filter((v) => gcd(v, n) === 1).length)],
    ],
    describe: (i, j) => ({
      title: `${elements[i]} ${symbol} ${elements[j]} ≡ ${valueAt(i, j)} (mod ${n})`,
      rows: [
        ["unit", String(gcd(valueAt(i, j), n) === 1)],
        [operation === "Add" ? "additive order" : "order", String(order(valueAt(i, j)) || "—")],
      ],
    }),
  };
}
