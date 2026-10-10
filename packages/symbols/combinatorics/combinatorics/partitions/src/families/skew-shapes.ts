// The reduced skew shapes λ/μ of n cells in plain numbers: the fast path of SkewPartitions
// (./skew-partitions.ts defines the family in Epsil, in this order) and the shapes
// SkewStandardTableaux fills. Row i of a shape is the interval [a, b] = [μᵢ + 1, λᵢ] of columns it
// covers; a and b weakly fall, aᵢ ≤ bᵢ, the last a is 1, and aᵢ ≤ bᵢ₊₁ + 1 (no column of 1..b₁ is
// skipped). Shapes are listed by b (as a vector, a prefix first) and then by a, which is the order
// of λ then μ with μ's trailing zeros dropped.
//
// T[c][a, b] counts the rows that can follow a row [a, b] with exactly c cells in all. The shapes
// with a given b prefix are then counted per call by a forward pass over (last a, cells used), and
// those with a given b by a backward pass over (a, cells left): both sums of counts of members, so
// exact while the fiber's count is a double.

/** A fiber past this many shapes (n = 34) is past 2^53: its count answers a double that is no integer. */
export const PAST_DOUBLES = 34;
/** Past this size no table is built: a call that needs one leaves the question to Epsil, which declines. */
const TABLE_LIMIT = 40;

const CACHED = 6;
const tables = new Map<number, Float64Array>();

/** T[c·n² + (a − 1)·n + b − 1]: continuations of a row [a, b] with c more cells, 1 ≤ a ≤ b ≤ n. */
function tablesOf(n: number): Float64Array {
  if (n > TABLE_LIMIT) throw new RangeError(`SkewPartitions(${n}): past 2^53`);
  let table = tables.get(n);
  if (table !== undefined) {
    tables.delete(n);
    tables.set(n, table);
    return table;
  }
  const w = n * n;
  table = new Float64Array((n + 1) * w);
  for (let b = 1; b <= n; b++) table[b - 1] = 1;
  for (let c = 1; c <= n; c++)
    for (let b = 1; b <= n; b++)
      for (let a = 1; a <= b; a++) {
        let sum = 0;
        for (let b2 = Math.max(a - 1, 1); b2 <= b; b2++)
          for (let a2 = Math.max(1, b2 - c + 1); a2 <= Math.min(a, b2); a2++)
            sum += table[(c - (b2 - a2 + 1)) * w + (a2 - 1) * n + b2 - 1];
        table[c * w + (a - 1) * n + b - 1] = sum;
      }
  tables.set(n, table);
  if (tables.size > CACHED) tables.delete(tables.keys().next().value!);
  return table;
}

/** The number of reduced skew shapes of n cells. */
export function skewShapeCount(n: number): number {
  if (n < 0) return 0;
  if (n === 0) return 1;
  // Past n = 33 the count passes 2^53, and the table is not worth building.
  if (n >= PAST_DOUBLES) return 2 ** 60;
  const table = tablesOf(n);
  let total = 0;
  for (let b = 1; b <= n; b++)
    for (let a = 1; a <= b; a++) total += table[(n - (b - a + 1)) * n * n + (a - 1) * n + b - 1];
  return total;
}

type Grid = Float64Array;
const side = (n: number): number => n + 1;

/** F after row t ends at beta: F[a][c] counts the choices of a's so far, the last one a, in c cells, and a
 *  row [a', beta] follows a row whose a is in a'..beta + 1. F[0][0] = 1 starts it: row 1 has no row above. */
function advanced(n: number, from: Grid, t: number, beta: number): Grid {
  const s = side(n);
  const next = new Float64Array(s * s);
  for (let a1 = 1; a1 <= beta; a1++) {
    const k = beta - a1 + 1;
    const lo = t === 1 ? 0 : a1;
    const hi = t === 1 ? 0 : Math.min(beta + 1, n);
    for (let c = k; c <= n; c++) {
      let sum = 0;
      for (let a = lo; a <= hi; a++) sum += from[a * s + c - k];
      next[a1 * s + c] = sum;
    }
  }
  return next;
}

/** How many shapes have the b prefix of F and a row t that ends at beta. */
function started(n: number, table: Float64Array, from: Grid, t: number, beta: number): number {
  const s = side(n);
  let sum = 0;
  for (let a1 = 1; a1 <= beta; a1++) {
    const k = beta - a1 + 1;
    const lo = t === 1 ? 0 : a1;
    const hi = t === 1 ? 0 : Math.min(beta + 1, n);
    for (let a = lo; a <= hi; a++)
      for (let c = 0; c + k <= n; c++) sum += from[a * s + c] * table[(n - c - k) * n * n + (a1 - 1) * n + beta - 1];
  }
  return sum;
}

const start = (n: number): Grid => {
  const grid = new Float64Array(side(n) * side(n));
  grid[0] = 1;
  return grid;
};

/** H[t][a][c]: the ways to choose the a's below row t, whose own is a, in c cells, for the b's in `bs`
 *  (layers[t - 1], a at a * (n + 1) + c). */
function backward(n: number, bs: readonly number[]): Grid[] {
  const s = side(n);
  const rows = bs.length;
  const layers: Grid[] = Array.from({ length: rows }, () => new Float64Array(s * s));
  layers[rows - 1][s] = 1;
  for (let t = rows - 1; t >= 1; t--) {
    const below = bs[t];
    for (let a = 1; a <= Math.min(n, below + 1); a++)
      for (let c = 0; c <= n; c++) {
        let sum = 0;
        for (let a2 = 1; a2 <= Math.min(below, a); a2++) {
          const k = below - a2 + 1;
          if (k <= c) sum += layers[t][a2 * s + c - k];
        }
        layers[t - 1][a * s + c] = sum;
      }
  }
  return layers;
}

/** The shape at rank r of n cells, as [λ, μ]. */
export function skewShapeUnrank(n: number, r: number): [number[], number[]] {
  if (n === 0) return [[], []];
  const table = tablesOf(n);
  const s = side(n);
  let grid = start(n);
  const bs: number[] = [];
  let cap = n;
  for (let t = 1; ; t++) {
    const done = grid[(t === 1 ? 0 : 1) * s + n];
    if (r < done) break;
    r -= done;
    let beta = 1;
    for (; beta <= cap; beta++) {
      const size = started(n, table, grid, t, beta);
      if (r < size) break;
      r -= size;
    }
    if (beta > cap) throw new RangeError(`SkewPartitions(${n}): rank out of range`);
    grid = advanced(n, grid, t, beta);
    bs.push(beta);
    cap = beta;
  }
  const layers = backward(n, bs);
  const mu: number[] = [];
  let used = 0;
  let above = n;
  for (let t = 1; t <= bs.length; t++) {
    const b = bs[t - 1];
    let a = 1;
    for (; a <= Math.min(b, above); a++) {
      const left = n - used - (b - a + 1);
      if (left < 0) continue;
      const size = layers[t - 1][a * s + left];
      if (r < size) break;
      r -= size;
    }
    mu.push(a - 1);
    used += b - a + 1;
    above = a;
  }
  while (mu.length > 0 && mu[mu.length - 1] === 0) mu.pop();
  return [bs, mu];
}

/** The place of a shape of n cells (a member) among them. */
export function skewShapeRank(n: number, lam: readonly number[], mu: readonly number[]): number {
  if (n === 0) return 0;
  const table = tablesOf(n);
  const s = side(n);
  let grid = start(n);
  let r = 0;
  for (let t = 1; t <= lam.length; t++) {
    r += grid[(t === 1 ? 0 : 1) * s + n];
    for (let beta = 1; beta < lam[t - 1]; beta++) r += started(n, table, grid, t, beta);
    grid = advanced(n, grid, t, lam[t - 1]);
  }
  const layers = backward(n, lam);
  let used = 0;
  let above = n;
  for (let t = 1; t <= lam.length; t++) {
    const b = lam[t - 1];
    const a = (mu[t - 1] ?? 0) + 1;
    for (let before = 1; before < a && before <= Math.min(b, above); before++) {
      const left = n - used - (b - before + 1);
      if (left >= 0) r += layers[t - 1][before * s + left];
    }
    used += b - a + 1;
    above = a;
  }
  return r;
}

/** Whether [lam, mu] is a reduced skew shape of n cells: μ has no zero part, every row has a cell,
 *  and every column from 1 to λ₁ is covered. */
export function IsSkewPartitionOf(element: unknown, n: number): boolean {
  if (!Array.isArray(element) || element.length !== 2) return false;
  const [lam, mu] = element as [unknown, unknown];
  if (!Array.isArray(lam) || !Array.isArray(mu) || mu.length > lam.length) return false;
  if (![...lam, ...mu].every(Number.isInteger)) return false;
  const rows = lam.length;
  // The last row starts in column 1.
  if (rows > 0 && mu.length === rows) return false;
  const first = (i: number): number => (i < mu.length ? (mu[i] as number) + 1 : 1);
  let cells = 0;
  for (let i = 0; i < rows; i++) {
    const [a, b] = [first(i), lam[i] as number];
    if ((i < mu.length && mu[i] < 1) || a > b) return false;
    // Rows fall left and right, and meet or overlap: the column before this row's cells,
    // where the row above starts, is the one the row ends at or past.
    if (i > 0 && (b > lam[i - 1] || a > first(i - 1) || first(i - 1) > b + 1)) return false;
    cells += b - a + 1;
  }
  return cells === n;
}
