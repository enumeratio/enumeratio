// PlanePartitions(n): a TS kernel, the definition (no Epsil). Order: the shape (row lengths) lex, a
// prefix first, then the entries row-major lex. Unrank and rank walk a per-shape table, then enumerate
// the one shape they land in.
//
// The table: the layers of a plane partition (the cells at least k) are nested shapes, so with
// h(μ, s) its count by outer shape μ and sum s, h(μ, s) = [s = |μ|] + Σ_{∅≠ν⊆μ} h(ν, s − |μ|)
// (ν⊆μ the shape of the layer above). F_μ(t) = Σ_{∅≠ν⊆μ} h(ν, t) is summed over the subshapes by
// inclusion–exclusion over the removable corners, so no pair of shapes is tested.
//
// Shapes are integer ids, their preorder in a trie of row lengths (a prefix before its extensions, rows
// ascending, which is the family's order, and every subshape before its shape). The counts live in one flat
// array, a slice per shape; a shape's corner-removed subshapes are found by walking the trie, once per set
// of corners.

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

const sum = (a: readonly number[]): number => a.reduce((x, y) => x + y, 0);

interface Table {
  /** Shapes of at most n cells are the ids 1..count (0 is the empty shape), in the family's order. */
  readonly count: number;
  readonly parent: Int32Array; // the shape without its last row
  readonly last: Uint8Array; // its last row (n for the empty shape)
  readonly cells: Uint8Array;
  /** The shape with last row v, extending id, is kids[firstKid[id] + v − 1]. */
  readonly firstKid: Int32Array;
  readonly kids: Int32Array;
  /** offset[id] = the plane partitions of n on the shapes before id; offset[count + 1] is the count. */
  readonly offset: Float64Array;
}

/** p(0..n) by Euler's pentagonal recurrence. */
function partitionNumbers(n: number): bigint[] {
  const p: bigint[] = [1n];
  for (let m = 1; m <= n; m++) {
    let acc = 0n;
    for (let k = 1; (k * (3 * k - 1)) / 2 <= m; k++) {
      const s = k % 2 === 1 ? 1n : -1n;
      acc += s * p[m - (k * (3 * k - 1)) / 2];
      if ((k * (3 * k + 1)) / 2 <= m) acc += s * p[m - (k * (3 * k + 1)) / 2];
    }
    p.push(acc);
  }
  return p;
}

function buildTable(n: number): Table {
  const p = partitionNumbers(n).map(Number);
  let nodes = 0;
  let entries = 0;
  for (let m = 0; m <= n; m++) {
    nodes += p[m];
    entries += p[m] * (n - m + 1);
  }
  const parent = new Int32Array(nodes);
  const last = new Uint8Array(nodes);
  const cells = new Uint8Array(nodes);
  const firstKid = new Int32Array(nodes);
  const kids = new Int32Array(nodes);
  const offset = new Float64Array(nodes + 1);
  last[0] = n;
  // F_μ(t) for t in 0..n − |μ|, F(0) = 0, a slice at base[id]; the empty shape's stays zero.
  const base = new Int32Array(nodes);
  const f = new Float64Array(entries);
  let top = n + 1;
  // At most c(c + 1)/2 ≤ n cells make c corners.
  const maxCorners = Math.floor((Math.sqrt(8 * n + 1) - 1) / 2);
  const ids = new Int32Array(1 << maxCorners); // the subshape with the corner set (a mask) removed
  const odd = new Uint8Array(1 << maxCorners);
  for (let mask = 1; mask < odd.length; mask++) odd[mask] = odd[mask >> 1] ^ (mask & 1);
  const row = new Int32Array(n + 1); // the shape being built
  let len = 0;

  // The corners are the last rows of the runs of equal rows. Per run, ids[0..2^j) become ids[0..2^(j+1)):
  // each id takes the run kept, and with the run's last row shortened (bit j). Returns the corner count.
  const subshapes = (): number => {
    let corners = 0;
    ids[0] = 0;
    for (let r = 0; r < len;) {
      let end = r;
      while (end < len - 1 && row[end] === row[end + 1]) end++;
      const v = row[end];
      const bit = 1 << corners++;
      for (let mask = 0; mask < bit; mask++) {
        let node = ids[mask];
        for (let q = r; q < end; q++) node = kids[firstKid[node] + v - 1];
        // A one-cell last row, shortened, is gone.
        ids[mask | bit] = v === 1 ? node : kids[firstKid[node] + v - 2];
        ids[mask] = kids[firstKid[node] + v - 1];
      }
      r = end + 1;
    }
    return corners;
  };

  const fill = (id: number): void => {
    const m = cells[id];
    const size = n - m + 1;
    const b = top;
    top += size;
    base[id] = b;
    if (size === 1) {
      // Nothing sits above a shape of n cells.
      offset[id + 1] = offset[id] + 1;
      return;
    }
    const corners = subshapes();
    // Σ over the nonempty sets of corners, signed, of F_{μ − C}: the subshapes strictly inside μ.
    for (let mask = 1; mask < 1 << corners; mask++) {
      const nu = ids[mask];
      if (nu === 0) continue;
      const from = base[nu];
      if (odd[mask]) for (let t = 1; t < size; t++) f[b + t] += f[from + t];
      else for (let t = 1; t < size; t++) f[b + t] -= f[from + t];
    }
    for (let t = m; t < size; t++) f[b + t] += (t === m ? 1 : 0) + f[b + t - m];
    offset[id + 1] = offset[id] + (m === n ? 1 : 0) + f[b + n - m];
  };

  let next = 1;
  let kidAt = 0;
  const grow = (id: number, used: number): void => {
    const cap = Math.min(last[id], n - used);
    firstKid[id] = kidAt;
    kidAt += cap;
    for (let v = 1; v <= cap; v++) {
      const kid = next++;
      kids[firstKid[id] + v - 1] = kid;
      parent[kid] = id;
      last[kid] = v;
      cells[kid] = used + v;
      row[len] = v;
      len++;
      fill(kid);
      grow(kid, used + v);
      len--;
    }
  };
  grow(0, 0);
  return { count: nodes - 1, parent, last, cells, firstKid, kids, offset };
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
 * Σ_{m≤n} p(m)·(n − m + 1), each about half a step (0.1 µs: a few corner sets, each an integer lookup and
 * an add or two). That puts a cold call near half a second at the limit, n = 46; the walk within the
 * biggest shape's fiber adds at most 0.1 s there.
 */
export function planePartitionsWork(n: number): bigint {
  if (n < 1) return 0n;
  if (n > 200) return 2n ** 64n; // far past the limit; p(m) up to n is not worth computing
  const p = partitionNumbers(n);
  let entries = 0n;
  for (let m = 1; m <= n; m++) entries += p[m] * BigInt(n - m + 1);
  return (entries + 1n) / 2n;
}

export function PlanePartitionsUnrank(n: number, rank: number): number[][] {
  if (n <= 0) return [];
  const { count, parent, last, offset } = tableOf(n);
  const r = normRank(rank, offset[count + 1]);
  // The last shape whose offset is at most r.
  let lo = 1;
  let hi = count;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offset[mid] <= r) lo = mid;
    else hi = mid - 1;
  }
  const shape: number[] = [];
  for (let id = lo; id !== 0; id = parent[id]) shape.push(last[id]);
  shape.reverse();
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
  const { last, cells, firstKid, kids, offset } = tableOf(n);
  let id = 0;
  for (const v of shape) {
    if (v > Math.min(last[id], n - cells[id])) return -1;
    id = kids[firstKid[id] + v - 1];
  }
  const target = e.flat();
  let index = 0;
  let hit = false;
  walkFiber(shape, n, (flat) => {
    hit = flat.every((v, i) => v === target[i]);
    if (!hit) index++;
    return hit;
  });
  return hit ? offset[id] + index : -1;
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
