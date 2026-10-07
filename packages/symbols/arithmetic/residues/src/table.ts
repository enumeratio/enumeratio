// ℤ/n's multiplication table as a layer to draw: cell (i, j) holds aᵢ·aⱼ mod n, row i going down
// and column j across, the elements aᵢ in natural order or by their Chinese remainders, and answers what a `Show`'s rules ask of it — properties of its value
// (`IsUnit`, `IsIdempotent`, `IsSquare`), values (`Value`, `Row`, `Column`, `Difference`, `Order`)
// and relations to a selected cell (`SameValue`, `SquareRoots`, `Associates`, `Multiples`).
//
// Plenty shows at a glance: the units form a Latin square, the idempotents line up with the
// factors of n (the Chinese remainder theorem), and a 1 at (x, x − k) says x(x − k) = 1: x is a
// root of x² − kx − 1, a "metallic mean" of ℤ/n, read off the diagonal where Difference ≡ −k.

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
export const TABLE_VALUES = ["Value", "Row", "Column", "Difference", "Order", "Modulus"] as const;
export const TABLE_RELATIONS = [
  "SameValue",
  "SquareRoots",
  "SameRow",
  "SameColumn",
  "Associates",
  "Multiples",
] as const;

/**
 * How a table lists ℤ/n's elements along its rows and columns: `Natural` (0, 1, …, n − 1), or
 * `ChineseRemainder`, by their residues modulo each prime power of n, smallest first, so the
 * table falls into blocks: ℤ/15's is ℤ/3's table with ℤ/5's in each cell.
 */
export type ElementOrder = "Natural" | "ChineseRemainder";

/** n's prime powers, smallest prime first. */
function primePowers(n: number): number[] {
  const out: number[] = [];
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p !== 0) continue;
    let q = 1;
    while (m % p === 0) {
      m /= p;
      q *= p;
    }
    out.push(q);
  }
  if (m > 1) out.push(m);
  return out;
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
export function multiplicationTable(n: number, listing: ElementOrder = "Natural"): ResidueTable | undefined {
  if (!Number.isInteger(n) || n < 2 || n > MAX_MODULUS) return undefined;
  const rad = radical(n);
  const powers = primePowers(n);
  const elements = [...Array(n).keys()];
  if (listing === "ChineseRemainder")
    elements.sort((a, b) => {
      for (const q of powers) if (a % q !== b % q) return (a % q) - (b % q);
      return 0;
    });
  const inside = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < n && j < n;
  const valueAt = (i: number, j: number): number => (elements[i]! * elements[j]!) % n;

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
  /** The multiplicative order of a unit; 0 for a non-unit. Capped by n, as an order divides φ(n) < n. */
  const order = (v: number): number => {
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

  return {
    title: `ℤ/${n} × ℤ/${n}`,
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
    ...(listing === "ChineseRemainder" && powers.length > 1
      ? { autoGrid: [n / powers[0]!, n / powers[0]!] as const }
      : {}),
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
      }
      return undefined;
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
      }
      return false;
    },
    summary: () => [
      ["modulus", String(n)],
      ["units", String([...Array(n).keys()].filter((v) => gcd(v, n) === 1).length)],
    ],
    describe: (i, j) => ({
      title: `${elements[i]} · ${elements[j]} ≡ ${valueAt(i, j)} (mod ${n})`,
      rows: [
        ["unit", String(gcd(valueAt(i, j), n) === 1)],
        ["order", String(order(valueAt(i, j)) || "—")],
      ],
    }),
  };
}
