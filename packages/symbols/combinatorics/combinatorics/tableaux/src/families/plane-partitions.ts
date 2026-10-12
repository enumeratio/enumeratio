// PlanePartitions(n): a TS kernel, the definition (no Epsil). Order: the shape (row lengths) lex, a
// prefix first, then the entries row-major lex. Unrank and rank walk a per-shape table, then enumerate
// the one shape they land in.
//
// The table: the layers of a plane partition (the cells at least k) are nested shapes, so with
// h(μ, s) its count by outer shape μ and sum s, h(μ, s) = [s = |μ|] + Σ_{∅≠ν⊆μ} h(ν, s − |μ|)
// (ν⊆μ the shape of the layer above). F_μ(t) = Σ_{∅≠ν⊆μ} h(ν, t) is summed over the subshapes by
// inclusion–exclusion over the removable corners, so no pair of shapes is tested.

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

const cmpShapes = (a: readonly number[], b: readonly number[]): number => {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
};

interface Table {
  /** Every nonempty shape of at most n cells, in the family's order. */
  readonly shapes: number[][];
  /** offset[k] = the plane partitions of n on the shapes before shapes[k]; one past the end is the count. */
  readonly offset: Float64Array;
}

/** Shapes of at most n cells, a prefix before its extensions, each part weakly under the last. */
function shapesUpTo(n: number): number[][] {
  const shapes: number[][] = [];
  const cur: number[] = [];
  (function gen(used: number): void {
    if (cur.length > 0) shapes.push(cur.slice());
    const cap = Math.min(cur.length > 0 ? cur[cur.length - 1] : n, n - used);
    for (let v = 1; v <= cap; v++) {
      cur.push(v);
      gen(used + v);
      cur.pop();
    }
  })(0);
  return shapes;
}

function buildTable(n: number): Table {
  const shapes = shapesUpTo(n);
  // F[t] for t in 0..n − |μ|, F[0] = 0.
  const memo = new Map<string, Float64Array>();
  const tableOf = (mu: readonly number[]): Float64Array => {
    const key = mu.join(",");
    const hit = memo.get(key);
    if (hit) return hit;
    const m = sum(mu);
    const size = n - m + 1;
    const corners: number[] = [];
    for (let i = 0; i < mu.length; i++) if (i === mu.length - 1 || mu[i] > mu[i + 1]) corners.push(i);
    // Σ over the nonempty sets C of corners, signed, of F_{μ − C}: the subshapes strictly inside μ.
    const inside = new Float64Array(size);
    for (let mask = 1; mask < 1 << corners.length; mask++) {
      const nu = mu.slice();
      let bits = 0;
      for (let b = 0; b < corners.length; b++)
        if (mask & (1 << b)) {
          nu[corners[b]]--;
          bits++;
        }
      while (nu.length > 0 && nu[nu.length - 1] === 0) nu.pop();
      if (nu.length === 0) continue;
      const below = tableOf(nu);
      const sign = bits % 2 === 1 ? 1 : -1;
      for (let t = 1; t < size; t++) inside[t] += sign * below[t];
    }
    const f = new Float64Array(size);
    for (let t = 1; t < size; t++) f[t] = (t >= m ? (t === m ? 1 : 0) + f[t - m] : 0) + inside[t];
    memo.set(key, f);
    return f;
  };
  const offset = new Float64Array(shapes.length + 1);
  shapes.forEach((mu, k) => {
    const m = sum(mu);
    const f = tableOf(mu);
    offset[k + 1] = offset[k] + (m === n ? 1 : 0) + f[n - m];
  });
  return { shapes, offset };
}

// The last two tables: a table is a few MB at n = 30 and grows quickly.
const tables = new Map<number, Table>();
function tableOf(n: number): Table {
  let t = tables.get(n);
  if (!t) {
    // Offsets are doubles: past 2^53 (before any table is built) the kernel declines.
    if (n > 200 || PlanePartitionsCount(n) > Number.MAX_SAFE_INTEGER)
      throw new RangeError("PlanePartitions: not bigint yet");
    t = buildTable(n);
    if (tables.size >= 2) tables.delete(tables.keys().next().value as number);
    tables.set(n, t);
  }
  return t;
}

/**
 * Every filling of `shape` (positive entries, weakly falling along rows and down columns) summing to n,
 * row-major lex, passing `visit` each as its flat entries; stops when `visit` returns true. Each entry is
 * bounded so the rest can still reach n (all ones at least; at most the cells under the row's entries
 * and the rest of the row at their caps), so no branch dies and a visit costs a few cells.
 */
function walkFiber(shape: readonly number[], n: number, visit: (flat: Int32Array) => boolean): void {
  const cells = sum(shape);
  const cur = new Int32Array(cells);
  const rowStart = new Int32Array(cells);
  const rowEnd = new Int32Array(cells); // one past the cell's row
  const upOf = new Int32Array(cells); // the cell above, or -1
  const below = new Int32Array(cells); // cells under this one in its column
  let k = 0;
  for (let i = 0; i < shape.length; i++) {
    const start = k;
    for (let j = 0; j < shape[i]; j++, k++) {
      rowStart[k] = start;
      rowEnd[k] = start + shape[i];
      upOf[k] = i > 0 ? start - shape[i - 1] + j : -1;
      let b = 0;
      for (let r = i + 1; r < shape.length && shape[r] > j; r++) b++;
      below[k] = b;
    }
  }
  // belowSum: the cells under the row's entries so far, each at most the entry above it.
  const rec = (at: number, used: number, belowSum: number): boolean => {
    if (at === cells) return visit(cur);
    const left = at > rowStart[at] ? cur[at - 1] : Infinity;
    const up = upOf[at] >= 0 ? cur[upOf[at]] : Infinity;
    const hi = Math.min(left, up, n - used - (cells - at - 1));
    const end = rowEnd[at];
    for (let v = 1; v <= hi; v++) {
      const rest = n - used - v;
      const under = belowSum + v * below[at];
      let reach = under;
      for (let q = at + 1; q < end; q++) reach += Math.min(v, upOf[q] >= 0 ? cur[upOf[q]] : v) * (1 + below[q]);
      if (rest > reach) continue;
      cur[at] = v;
      if (rec(at + 1, used + v, at + 1 === end ? 0 : under)) return true;
    }
    return false;
  };
  rec(0, 0, 0);
}

const rowsOf = (shape: readonly number[], flat: Int32Array): number[][] => {
  let at = 0;
  return shape.map((len) => {
    const row = Array.from(flat.subarray(at, at + len));
    at += len;
    return row;
  });
};

/** A000219 without enumerating: MacMahon's Π (1 − x^k)^(−k), through the Euler-transform
 *  recurrence n·PL(n) = Σ_{k=1..n} σ₂(k)·PL(n−k), exact in bigint. */
export function PlanePartitionsCount(n: number): number {
  if (n < 0) return 0;
  const sigma2 = (k: number): bigint => {
    let s = 0n;
    for (let d = 1; d <= k; d++) if (k % d === 0) s += BigInt(d * d);
    return s;
  };
  const pl: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let acc = 0n;
    for (let k = 1; k <= m; k++) acc += sigma2(k) * (pl[m - k] as bigint);
    pl.push(acc / BigInt(m));
  }
  return Number(pl[n]);
}

/**
 * The steps of a call: the table has an entry per nonempty shape of at most n cells and sum above it,
 * Σ_{m≤n} p(m)·(n − m + 1), each about 6 steps: a mask per set of the shape's removable corners
 * (2^corners), each a string key and a map lookup before its adds. That puts a cold call near half a second
 * at the limit. The walk within one shape is far less (tens of ms at n = 44).
 */
export function planePartitionsWork(n: number): bigint {
  if (n < 1) return 0n;
  if (n > 200) return 2n ** 64n; // far past the limit; p(m) up to n is not worth computing
  const p: bigint[] = [1n]; // partition numbers, by Euler's pentagonal recurrence
  for (let m = 1; m <= n; m++) {
    let acc = 0n;
    for (let k = 1; (k * (3 * k - 1)) / 2 <= m; k++) {
      const s = k % 2 === 1 ? 1n : -1n;
      acc += s * p[m - (k * (3 * k - 1)) / 2];
      if ((k * (3 * k + 1)) / 2 <= m) acc += s * p[m - (k * (3 * k + 1)) / 2];
    }
    p.push(acc);
  }
  let steps = 0n;
  for (let m = 1; m <= n; m++) steps += p[m] * BigInt(n - m + 1);
  return 6n * steps;
}

export function PlanePartitionsUnrank(n: number, rank: number): number[][] {
  if (n <= 0) return [];
  const { shapes, offset } = tableOf(n);
  const r = normRank(rank, offset[shapes.length]);
  // The last shape whose offset is at most r.
  let lo = 0;
  let hi = shapes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offset[mid] <= r) lo = mid;
    else hi = mid - 1;
  }
  const shape = shapes[lo];
  let left = r - offset[lo];
  let found: Int32Array | undefined;
  walkFiber(shape, n, (flat) => {
    if (left-- > 0) return false;
    found = flat.slice();
    return true;
  });
  if (!found) throw new Error(`PlanePartitions: rank out of range for shape ${shape.join(",")}`);
  return rowsOf(shape, found);
}

/** The rank of `e`, or -1 where it is no plane partition of n. */
export function PlanePartitionsRank(e: number[][], n: number): number {
  if (!IsPlanePartitionOf(e, n)) return -1;
  if (n === 0) return 0;
  const shape = e.map((row) => row.length);
  const { shapes, offset } = tableOf(n);
  let lo = 0;
  let hi = shapes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmpShapes(shapes[mid], shape) < 0) lo = mid + 1;
    else hi = mid;
  }
  if (cmpShapes(shapes[lo], shape) !== 0) return -1;
  const target = e.flat();
  let index = 0;
  let hit = false;
  walkFiber(shape, n, (flat) => {
    hit = flat.every((v, i) => v === target[i]);
    if (!hit) index++;
    return hit;
  });
  return hit ? offset[lo] + index : -1;
}

export function IsPlanePartitionOf(e: unknown, n: number): boolean {
  if (!Array.isArray(e)) return false;
  const rows = e as number[][];
  let total = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) return false;
    if (r > 0 && rows[r - 1].length < row.length) return false;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (!Number.isInteger(v) || v < 1) return false;
      if (c > 0 && row[c - 1] < v) return false;
      if (r > 0 && rows[r - 1][c] < v) return false;
      total += v;
    }
  }
  return total === n;
}
