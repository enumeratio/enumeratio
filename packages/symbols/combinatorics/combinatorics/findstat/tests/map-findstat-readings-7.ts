// Readings for maps batch 7 (Dyck paths, integer partitions and set partitions), after the Sage code FindStat
// states for each map, except where the map has a defining property to search by (Mp00119). Same contract as
// map-findstat-readings.ts: FindStat's text in, FindStat's text out.

import type { Reading } from "./map-findstat-readings.ts";

const ints = (text: string): number[] => JSON.parse(text) as number[];
const list = (items: readonly number[]): string => `[${items.join(",")}]`;
const rowsText = (items: readonly (readonly number[])[]): string => `[${items.map(list).join(",")}]`;
const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
const sum = (items: readonly number[]): number => items.reduce((a, b) => a + b, 0);

const blocks = (text: string): number[][] =>
  (JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][])
    .map((block) => block.toSorted((a, b) => a - b))
    .toSorted((a, b) => a[0]! - b[0]!);
const blocksText = (items: readonly (readonly number[])[]): string =>
  `{${items
    .map((block) => block.toSorted((a, b) => a - b))
    .toSorted((a, b) => a[0]! - b[0]!)
    .map((block) => `{${block.join(",")}}`)
    .join(",")}}`;

/** Each up step's height before it (the area sequence). */
const areaSequence = (word: readonly number[]): number[] => {
  const out: number[] = [];
  let height = 0;
  for (const step of word) {
    if (step === 1) out.push(height);
    height += step === 1 ? 1 : -1;
  }
  return out;
};

const heightsAfter = (word: readonly number[]): number[] => {
  let h = 0;
  return word.map((step) => (h += step === 1 ? 1 : -1));
};

// --- parallelogram polyominoes, as Sage's paths: 1 up and 0 right, lower and upper ---

/** Sage's classical bijection to Dyck words: 1 - lower[0], then upper[i] and 1 - lower[i], then the last upper. */
const polyominoToDyck = (lower: readonly number[], upper: readonly number[]): number[] => {
  const size = lower.length - 1;
  if (size === 0) return [];
  const out = [1 - lower[0]!];
  for (let i = 1; i < size; i++) out.push(upper[i]!, 1 - lower[i]!);
  out.push(upper[size]!);
  return out;
};
/** The polyomino of a Dyck word: from [1] + D + [0], the even entries are the upper path, the odd ones complemented the lower. */
const dyckToPolyomino = (word: readonly number[]): [number[], number[]] => {
  const l = [1, ...word, 0];
  const upper: number[] = [];
  const lower: number[] = [];
  for (let i = 0; i < l.length; i += 2) {
    upper.push(l[i]!);
    lower.push(1 - l[i + 1]!);
  }
  return [lower, upper];
};
/** The number of 0s before each 1 of the path. */
const prefixLengths = (path: readonly number[]): number[] => {
  const out: number[] = [];
  let zeros = 0;
  for (const e of path) {
    if (e === 0) zeros++;
    else out.push(zeros);
  }
  return out;
};

const delestViennot = (dyck: readonly number[]): number[] => {
  if (dyck.length === 0) return [];
  const a: number[] = [];
  const b: number[] = [0];
  let h = 0;
  for (let i = 0; i < dyck.length - 1; i++) {
    if (dyck[i] === 1) {
      h++;
      if (dyck[i + 1] === 0) a.push(h);
    } else {
      if (dyck[i + 1] === 1) b.push(h);
      h--;
    }
  }
  b.push(0);
  const down: number[] = [];
  const up: number[] = [];
  for (let i = 0; i < a.length; i++) {
    down.push(...Array<number>(a[i]! - b[i]!).fill(0), 1);
    up.push(1, ...Array<number>(a[i]! - b[i + 1]!).fill(0));
  }
  return polyominoToDyck(down, up);
};

const inverseDelestViennot = (dyck: readonly number[]): number[] => {
  const [lower, upper] = dyckToPolyomino(dyck);
  const lh = prefixLengths(lower);
  const uh = prefixLengths(upper);
  const a = lh.map((x, k) => x - uh[k]!).slice(0, Math.min(lh.length, uh.length));
  const b = [0, ...range(0, a.length - 2).map((i) => a[i]! - uh[i + 1]! + uh[i]! - 1), 0];
  const out: number[] = [];
  for (let i = 0; i < a.length; i++)
    out.push(
      ...Array<number>(Math.max(0, a[i]! - b[i]!)).fill(1),
      ...Array<number>(Math.max(0, a[i]! - b[i + 1]!)).fill(0),
    );
  return out;
};

const reflected = (dyck: readonly number[]): number[] => {
  const [lower, upper] = dyckToPolyomino(dyck);
  return polyominoToDyck(
    upper.map((v) => 1 - v),
    lower.map((v) => 1 - v),
  );
};

// --- permutations from Dyck paths ---

const peaksPath = (w: readonly number[]): number[] => {
  const out: number[] = [];
  let top = 0;
  for (const v of w) {
    if (v > top) {
      out.push(...Array<number>(v - top).fill(1));
      top = v;
    }
    out.push(0);
  }
  return out;
};
const avoids321 = (w: readonly number[]): boolean =>
  !w.some((a, i) => w.some((b, j) => j > i && b < a && w.some((c, k) => k > j && c < b)));
const permutationsOf = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutationsOf(n - 1).flatMap((rest) =>
        range(0, rest.length).map((i) => [...rest.slice(0, i), n, ...rest.slice(i)]),
      );

/** Each 321-avoiding permutation of 1..n by the path its left-to-right maxima trace, built once per n. */
const byPath = new Map<number, Map<string, number[]>>();
/** The unique 321-avoiding permutation whose left-to-right maxima trace the path: Krattenthaler's. */
const krattenthaler = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  if (!byPath.has(n)) {
    const table = new Map<string, number[]>();
    for (const w of permutationsOf(n)) if (avoids321(w)) table.set(peaksPath(w).join(), w);
    byPath.set(n, table);
  }
  const found = byPath.get(n)!.get(word.join());
  if (found === undefined) throw new Error("no permutation");
  return found;
};

const billeyJockuschStanley = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  // Run lengths of ups (a) and downs (d).
  const a: number[] = [];
  const d: number[] = [];
  for (let k = 0; k < word.length;) {
    let j = k;
    while (j < word.length && word[j] === word[k]) j++;
    (word[k] === 1 ? a : d).push(j - k);
    k = j;
  }
  const pi: (number | null)[] = Array<number | null>(n).fill(null);
  const rest = range(1, n);
  for (let i = 1; i < a.length; i++) {
    const e = 1 + sum(a.slice(0, i));
    const f = sum(d.slice(0, i)) - 1;
    pi[f] = e;
    rest.splice(rest.indexOf(e), 1);
  }
  let i = 0;
  for (const e of rest) {
    while (pi[i] !== null) i++;
    pi[i] = e;
  }
  return pi as number[];
};

const avoiding132 = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  const area = [...areaSequence(word), 0];
  const pi: number[] = [];
  const values = range(1, n);
  for (let i = 0; i < n; i++) {
    const t = n - i - area[n - i - 1]!;
    const v = area[n - i - 1]! + 1 > area[n - i]! ? t : Math.min(...values.filter((x) => x > t));
    pi.push(v);
    values.splice(values.indexOf(v), 1);
  }
  return pi;
};

const avoiding312 = (word: readonly number[]): number[] => {
  const n = word.length / 2;
  const pi = range(1, n);
  areaSequence(word).forEach((aj, j) => {
    for (let i = 0; i < aj; i++) {
      const s = j - i; // swap the 1-based positions s and s + 1
      [pi[s - 1], pi[s]] = [pi[s]!, pi[s - 1]!];
    }
  });
  return pi;
};

/** Row insertion of `word`, recording where each cell appears. */
const rskPair = (word: readonly number[]): [number[][], number[][]] => {
  const p: number[][] = [];
  const q: number[][] = [];
  word.forEach((letter, k) => {
    let x = letter;
    for (let r = 0; ; r++) {
      const row = (p[r] ??= []);
      const at = row.findIndex((y) => y > x);
      if (at === -1) {
        row.push(x);
        (q[r] ??= []).push(k + 1);
        break;
      }
      [x, row[at]] = [row[at]!, x];
    }
  });
  return [p, q];
};

/** The permutation whose insertion tableau is `p` and recording tableau `q`, found by searching the permutations. */
const inverseRsk = (p: readonly (readonly number[])[], q: readonly (readonly number[])[]): number[] => {
  const n = sum(p.map((row) => row.length));
  const found = permutationsOf(n).filter((w) => {
    const [pp, qq] = rskPair(w);
    return rowsText(pp) === rowsText(p) && rowsText(qq) === rowsText(q);
  });
  if (found.length !== 1) throw new Error(`${found.length} permutations`);
  return found[0]!;
};

// --- binary trees: `.` empty, `[L,R]` a node ---
type Tree = null | readonly [Tree, Tree];
const treeText = (t: Tree): string => (t === null ? "." : `[${treeText(t[0])},${treeText(t[1])}]`);
const parseTree = (text: string): Tree => {
  let at = 0;
  const tree = (): Tree => {
    if (text[at] === ".") {
      at++;
      return null;
    }
    at++;
    const l = tree();
    at++;
    const r = tree();
    at++;
    return [l, r];
  };
  return tree();
};
/** D = L 1 R 0 as the tree [T(L), T(R)]. */
const treeOfDyck = (word: readonly number[]): Tree => {
  if (word.length === 0) return null;
  const heights = heightsAfter(word);
  const last = word.length - 1;
  // The up step matched with the last step: the last place before it where the height was the one it returns to.
  let u = last - 1;
  while (!(word[u] === 1 && (u === 0 ? 0 : heights[u - 1]!) === heights[last]!)) u--;
  return [treeOfDyck(word.slice(0, u)), treeOfDyck(word.slice(u + 1, last))];
};
const dyckOfTree = (t: Tree): number[] => (t === null ? [] : [...dyckOfTree(t[0]), 1, ...dyckOfTree(t[1]), 0]);

// --- Biane's noncrossing partition ---
const noncrossing = (word: readonly number[]): number[][] => {
  const out: number[][] = [];
  let stack: number[] = [];
  let i = 0;
  let p = 1;
  while (i < word.length) {
    stack.push(p);
    let j = i + 1;
    while (j < word.length && word[j] === 0) j++;
    const nz = j - (i + 1);
    if (nz > 0) {
      out.push(stack.slice(-nz));
      stack = stack.slice(0, -nz);
    }
    i = j;
    p++;
  }
  return out;
};

// --- integer partitions ---
const minimalDyck = (la: readonly number[]): number[] => {
  if (la.length === 0) return [];
  const n = Math.max(...la.map((l, i) => i + l + 1));
  const out: number[] = Array<number>(n - la.length).fill(1);
  const copy = [...la];
  while (copy.length > 0) {
    const c = copy.pop()!;
    out.push(...Array<number>(c).fill(0));
    for (let i = 0; i < copy.length; i++) copy[i]! -= c;
    out.push(1);
  }
  out.push(...Array<number>(n - la[0]!).fill(0));
  return out;
};
const polyominoDyck = (la: readonly number[]): number[] => {
  if (la.length === 0) return [];
  const lower = [...Array<number>(la[0]!).fill(0), ...Array<number>(la.length).fill(1)];
  const upper: number[] = [];
  const padded = [...la, 0];
  for (let i = 0; i < padded.length - 1; i++) upper.push(1, ...Array<number>(padded[i]! - padded[i + 1]!).fill(0));
  return polyominoToDyck(lower, upper);
};
const exponents = (la: readonly number[]): number[] =>
  range(1, la.length === 0 ? 0 : Math.max(...la)).map((p) => la.filter((x) => x === p).length);
const glaisherFranklin = (la: readonly number[]): number[] => {
  const mu: number[] = [];
  const nu: number[] = [];
  exponents(la).forEach((m, k) => {
    const p = k + 1;
    if (p % 2 === 0) mu.push(...Array<number>(2 * m).fill(p / 2));
    else nu.push(...Array<number>(m).fill(p));
  });
  const kappa: number[] = [];
  exponents(nu.toReversed()).forEach((m, k) => {
    for (let i = 0; m >> i > 0; i++) if ((m >> i) & 1) kappa.push((k + 1) * 2 ** i);
  });
  return [...mu, ...kappa].toSorted((a, b) => b - a);
};
const inverseGlaisherFranklin = (la: readonly number[]): number[] => {
  const mu: number[] = [];
  const nu: number[] = [];
  exponents(la).forEach((m, k) => {
    const p = k + 1;
    mu.push(...Array<number>(Math.floor(m / 2)).fill(2 * p));
    if (m % 2 === 1) nu.push(p);
  });
  for (let i = 0; i < nu.length;) {
    const p = nu[i]!;
    if (p % 2 === 0) {
      nu.splice(i, 1);
      nu.push(p / 2, p / 2);
    } else i++;
  }
  return [...mu, ...nu].toSorted((a, b) => b - a);
};

// --- set partitions ---
const growthWord = (bl: readonly (readonly number[])[]): number[] => {
  const n = sum(bl.map((b) => b.length));
  return range(1, n).map((e) => bl.findIndex((b) => b.includes(e)));
};
const fromGrowthWord = (w: readonly number[]): number[][] => {
  const out: number[][] = [];
  w.forEach((label, k) => (out[label] ??= []).push(k + 1));
  return out;
};
/** Sage's intertwining word: each letter the number of arcs (and half-arcs from closers) crossing the one ending there. */
const intertwiningWord = (bl: readonly (readonly number[])[]): number[] => {
  const n = sum(bl.map((b) => b.length));
  const arcs: [number, number][] = bl.flatMap((b) => b.slice(1).map((e, k): [number, number] => [b[k]!, e]));
  const openers = bl.map((b) => b[0]!);
  const closers = bl.map((b) => b.at(-1)!);
  const out = Array<number>(n).fill(0);
  for (const i of openers)
    out[i - 1] = arcs.filter(([k, l]) => k < i && i < l).length + closers.filter((k) => k < i).length;
  for (const [i, j] of arcs)
    out[j - 1] = arcs.filter(([k, l]) => i < k && k < j && j < l).length + closers.filter((k) => i < k && k < j).length;
  return out;
};
const fromIntertwiningWord = (w: readonly number[]): number[][] => {
  if (w.length === 0) return [];
  const blocksSoFar: number[][] = [[1]];
  let closers = [1];
  let m = 0;
  for (let i = 1; i < w.length; i++) {
    if (w[i] === 1 + m) {
      m++;
      blocksSoFar.push([i + 1]);
    } else {
      const l = closers[w[i]!]!;
      blocksSoFar.find((b) => b.includes(l))!.push(i + 1);
      closers = closers.filter((c) => c !== l);
    }
    closers = [i + 1, ...closers];
  }
  return blocksSoFar;
};
/** The coarsest partition containing every arc i -> pi(i) with i <= pi(i), by union-find. */
const weakExceedance = (pi: readonly number[]): number[][] => {
  const parent = range(0, pi.length);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  pi.forEach((image, k) => {
    const i = k + 1;
    if (i <= image) parent[find(i)] = find(image);
  });
  const groups = new Map<number, number[]>();
  for (const e of range(1, pi.length)) groups.set(find(e), [...(groups.get(find(e)) ?? []), e]);
  return [...groups.values()];
};
const associatedTableau = (x: readonly (readonly number[])[]): number[][] => {
  const A = x.map((a) => a.toSorted((p, q) => p - q));
  const m = Math.max(...A.map((a) => a.length));
  if (m === 1) return A.toSorted((p, q) => p[0]! - q[0]!);
  const lastRow = A.filter((a) => a.length === m)
    .map((a) => a.at(-1)!)
    .toSorted((p, q) => p - q);
  const tt = associatedTableau(A.map((a) => a.slice(0, m - 1)));
  return tt.map((r, i) => (i < lastRow.length ? [...r, lastRow[i]!] : r));
};

export const BATCH_SEVEN_READINGS: Readonly<Record<string, Reading>> = {
  "CutOutPartition@DyckPath": (d) => {
    let n = ints(d).length / 2;
    const res: number[] = [];
    for (const c of ints(d).toReversed()) {
      if (c === 0) n--;
      else res.push(n);
    }
    return list(res.filter((x) => x > 0));
  },
  "TwoRowTableau@DyckPath": (d) => {
    const rowsOut: number[][] = [[], []];
    ints(d).forEach((step, i) => rowsOut[1 - step]!.push(i + 1));
    return rowsText(rowsOut);
  },
  "KrattenthalerPermutation@DyckPath": (d) => list(krattenthaler(ints(d))),
  "BilleyJockuschStanleyPermutation@DyckPath": (d) => list(billeyJockuschStanley(ints(d))),
  "Avoiding132Permutation@DyckPath": (d) => list(avoiding132(ints(d))),
  "Avoiding312Permutation@DyckPath": (d) => list(avoiding312(ints(d))),
  "Avoiding321Permutation@DyckPath": (d) => {
    const word = ints(d);
    const n = word.length / 2;
    const left: number[][] = [[], []];
    const right: number[][] = [[], []];
    for (let pos = 0; pos < n; pos++) {
      left[word[pos] === 1 ? 0 : 1]!.push(pos + 1);
      right[word[word.length - pos - 1] === 0 ? 0 : 1]!.push(pos + 1);
    }
    return list(
      inverseRsk(
        left.filter((r) => r.length > 0),
        right.filter((r) => r.length > 0),
      ),
    );
  },
  "NoncrossingPartition@DyckPath": (d) => blocksText(noncrossing(ints(d))),
  "TamariBinaryTree@DyckPath": (d) => treeText(treeOfDyck(ints(d))),
  "TamariDyckPath@BinaryTree": (t) => list(dyckOfTree(parseTree(t))),
  "DelestViennot@DyckPath": (d) => list(delestViennot(ints(d))),
  "InverseDelestViennot@DyckPath": (d) => list(inverseDelestViennot(ints(d))),
  "ReflectParallelogramPolyomino@DyckPath": (d) => list(reflected(ints(d))),

  "MinimalDyckPath@IntegerPartition": (p) => list(minimalDyck(ints(p))),
  "ParallelogramPolyominoDyckPath@IntegerPartition": (p) => list(polyominoDyck(ints(p))),
  "InitialTableau@IntegerPartition": (p) => {
    let next = 1;
    return rowsText(ints(p).map((part) => range(0, part - 1).map(() => next++)));
  },
  "ReadingTableau@IntegerPartition": (p) => {
    let next = 1;
    const initial = ints(p).map((part) => range(0, part - 1).map(() => next++));
    return rowsText(rskPair(initial.toReversed().flat())[1]);
  },
  "GlaisherFranklin@IntegerPartition": (p) => list(glaisherFranklin(ints(p))),
  "InverseGlaisherFranklin@IntegerPartition": (p) => list(inverseGlaisherFranklin(ints(p))),

  "IncreasingCyclePermutation@SetPartition": (s) => {
    const bl = blocks(s);
    const n = sum(bl.map((b) => b.length));
    const pi = Array<number>(n).fill(0);
    for (const b of bl) b.forEach((e, k) => (pi[e - 1] = b[(k + 1) % b.length]!));
    return list(pi);
  },
  "AssociatedStandardTableau@SetPartition": (s) => rowsText(associatedTableau(blocks(s))),
  "IntertwiningToDualMajorIndex@SetPartition": (s) => blocksText(fromGrowthWord(intertwiningWord(blocks(s)))),
  "DualMajorIndexToIntertwining@SetPartition": (s) => blocksText(fromIntertwiningWord(growthWord(blocks(s)))),
  "WeakExceedancePartition@Permutation": (p) => blocksText(weakExceedance(ints(p))),
  "RowSetPartition@StandardTableau": (t) => blocksText(JSON.parse(t) as number[][]),
};
