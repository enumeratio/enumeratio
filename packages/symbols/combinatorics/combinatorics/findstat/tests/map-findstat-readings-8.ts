// Readings for maps batch 8: the rook-placement bijections on set partitions of Wachs and White (gamma, rho)
// and Yip (psi), after Sage's SetPartition.to_rook_placement and SetPartitions.from_rook_placement. Same
// contract as map-findstat-readings.ts: FindStat's text in, FindStat's text out.

import type { Reading } from "./map-findstat-readings.ts";

type Rooks = [number, number][];

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
const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
const byRook = (a: [number, number], b: [number, number]): number => a[0] - b[0] || a[1] - b[1];

const size = (bl: readonly (readonly number[])[]): number => bl.reduce((s, b) => s + b.length, 0);
/** The pairs of consecutive elements of each block. */
const arcs = (bl: readonly (readonly number[])[]): Rooks =>
  bl.flatMap((b) => b.slice(1).map((e, k): [number, number] => [b[k]!, e]));
/** The coarsest set partition of 1..n joining each arc's ends. */
const fromArcs = (rooks: Rooks, n: number): number[][] => {
  const parent = range(0, n);
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x]!)));
  for (const [i, j] of rooks) parent[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  for (const e of range(1, n)) groups.set(find(e), [...(groups.get(find(e)) ?? []), e]);
  return [...groups.values()];
};
/** The block index of each element, blocks numbered by least element. */
const growth = (bl: readonly (readonly number[])[]): number[] => {
  const w = Array<number>(size(bl)).fill(0);
  bl.forEach((b, i) => b.forEach((e) => (w[e - 1] = i)));
  return w;
};
const fromGrowth = (w: readonly number[]): number[][] => {
  const out: number[][] = [];
  w.forEach((label, k) => (out[label] = [...(out[label] ?? []), k + 1]));
  return out.filter((b) => b !== undefined);
};

const toGamma = (bl: readonly (readonly number[])[]): Rooks => {
  const n = size(bl);
  if (n === 0) return [];
  const w = growth(bl);
  const openers = new Set(range(0, Math.max(...w)).map((i) => w.indexOf(i)));
  const rooks: Rooks = [];
  const attacked: number[] = [];
  for (let c = 0; c < n; c++) {
    if (openers.has(c)) continue;
    let r = 0;
    let wc = w[c]!;
    while (wc > 0 || attacked.includes(r)) {
      if (!attacked.includes(r)) wc--;
      r++;
    }
    rooks.push([n - c, n - r]);
    attacked.push(r);
  }
  return rooks.toSorted(byRook);
};

const fromGamma = (rooks: Rooks, n: number): number[][] => {
  if (n === 0) return [];
  const columns = range(1, n - 1).map((j) => new Set(range(n + 1 - j, n)));
  for (const [j, i] of rooks) {
    for (const x of range(j + 1, i)) columns[n - j - 1]!.delete(x);
    for (const l of range(n + 1 - j, n)) columns[l - 2]!.delete(i);
  }
  return fromGrowth([0, ...columns.map((c) => c.size)]);
};

const toRho = (bl: readonly (readonly number[])[]): Rooks => {
  const n = size(bl);
  if (n === 0) return [];
  const w = growth(bl);
  const wReversed = w.toReversed();
  const closers = range(0, Math.max(...w))
    .map((i) => n - wReversed.indexOf(i) - 1)
    .toSorted((a, b) => a - b);
  const rs = range(0, n - 1).map((i) => closers.filter((j) => j > i && w[j]! < w[i]!).length);
  const empty = closers.map((j) => n - j);
  const rooks: Rooks = [];
  for (let i = 1; i < n; i++) {
    const free = range(n + 1 - i, n).filter((j) => !empty.includes(j));
    if (rs[i]! < free.length) {
      const j = free[rs[i]!]!;
      rooks.push([n + 1 - j, i + 1]);
      empty.push(j);
    }
  }
  return rooks.toSorted(byRook);
};

const fromRho = (rooks: Rooks, n: number): number[][] => {
  const cols = rooks.map(([j]) => j);
  const closers = range(1, n).filter((j) => !cols.includes(j));
  const columns = range(1, n - 1).map((j) =>
    closers.includes(n - j) ? new Set<number>() : new Set(range(n + 1 - j, n)),
  );
  for (const [j, i] of rooks) {
    for (const x of range(i, n)) columns[n - j - 1]!.delete(x);
    for (const l of range(n + 1 - j, n)) columns[l - 2]!.delete(i);
  }
  const flat = columns.flatMap((c) => [...c]);
  const out: number[][] = closers.map(() => []);
  for (const i of range(1, n)) {
    let k = flat.filter((x) => x === i).length;
    let b = 0;
    while (k > 0 || (out[b]!.length > 0 && closers.includes(out[b]!.at(-1)!))) {
      if (!closers.includes(out[b]!.at(-1)!)) k--;
      b++;
    }
    out[b]!.push(i);
  }
  return out;
};

const byLengthThenLeast = (a: readonly number[], b: readonly number[]): number =>
  b.length - a.length || Math.min(...a) - Math.min(...b);

const toPsi = (bl: readonly (readonly number[])[]): Rooks => {
  const n = size(bl);
  let p = bl.map((b) => b.toSorted((a, c) => a - c));
  const degrees: [number, number][] = [];
  for (let j = n; j >= 1; j--) {
    const block = p.find((b) => b.at(-1) === j)!;
    if (block.length === 1) p = p.filter((b) => b !== block);
    else {
      block.pop();
      p = p.toSorted(byLengthThenLeast);
      degrees.push([j, j - p.indexOf(block) - 1]);
    }
  }
  const rooks: Rooks = [];
  const attacked: number[] = [];
  for (const [j, d] of degrees.toReversed()) {
    let i = 1;
    while (d > i + attacked.filter((r) => r > i).length) i++;
    attacked.push(i);
    rooks.push([i, j]);
  }
  return rooks.toSorted(byRook);
};

const fromPsi = (rooks: Rooks, n: number): number[][] => {
  let p: number[][] = [];
  const rowOf = new Map(rooks.map(([i, j]) => [j, i]));
  for (let c = 1; c <= n; c++) {
    const r = rowOf.get(c);
    const weight =
      r === undefined ? rooks.filter(([, j]) => j < c).length : r + rooks.filter(([i, j]) => i > r && j < c).length;
    const b = c - weight;
    if (p.length === b - 1) p.push([c]);
    else p[b - 1]!.push(c);
    p = p.toSorted(byLengthThenLeast);
  }
  return p;
};

// --- Dyck paths ---

const ints = (text: string): number[] => JSON.parse(text) as number[];
const list = (items: readonly number[]): string => `[${items.join(",")}]`;
const isDyck = (word: readonly number[]): boolean => {
  let h = 0;
  for (const step of word) {
    h += step === 1 ? 1 : -1;
    if (h < 0) return false;
  }
  return h === 0;
};
const heightsOf = (word: readonly number[]): number[] => {
  const out = [0];
  for (const step of word) out.push(out.at(-1)! + (step === 1 ? 1 : -1));
  return out;
};

/** Sage's Cori-Le Borgne: the first rotation of the reversed path with a down step appended that is a Dyck word
 *  once the last step is dropped. */
const coriLeBorgne = (d: readonly number[]): number[] => {
  const rev = [...d, 0].toReversed();
  for (let i = 0; i <= d.length; i++) {
    const image = [...rev.slice(i), ...rev.slice(0, i)].slice(0, -1);
    if (isDyck(image)) return image;
  }
  throw new Error("no image");
};

/** Sage's Elizalde-Deutsch: the partner of each step in the matching of ups with downs, read in the order
 *  1, 2n, 2, 2n - 1, ... */
const elizaldeDeutsch = (d: readonly number[]): number[] => {
  const twoN = d.length;
  const sigma = range(1, twoN).map((i) => (i % 2 === 1 ? (i + 1) / 2 : twoN + 1 - i / 2));
  const sigmaInverse = (p: number): number => sigma.indexOf(p) + 1;
  const partner = Array<number>(twoN + 1).fill(0);
  const open: number[] = [];
  d.forEach((step, k) => {
    if (step === 1) open.push(k + 1);
    else {
      const a = open.pop()!;
      partner[a] = k + 1;
      partner[k + 1] = a;
    }
  });
  return sigma.map((s, k) => (sigmaInverse(partner[s]!) > k + 1 ? 1 : 0));
};

/** Sage's Barnabei-Castronuovo, by the canonical decomposition of each half. */
const barnabeiCastronuovo = (d: readonly number[]): number[] => {
  const decomposition = (w: readonly number[]): number[][] => {
    const n = w.length;
    const h = heightsOf(w);
    const out: number[][] = [];
    let i = 0;
    while (i < n) {
      let j = n;
      while (j > i && h[j] !== h[i]) j--;
      if (j === i) {
        out.push([]);
        i++;
      } else {
        out.push(w.slice(i, j));
        i = j;
      }
    }
    return out;
  };
  const star = (w: readonly number[]): number[] =>
    decomposition(w)
      .toReversed()
      .flatMap((piece) => (piece.length === 0 ? [1] : piece.toReversed().map((e) => 1 - e)));
  const n = d.length / 2;
  return [
    ...star(d.slice(0, n)),
    ...star(
      d
        .slice(n)
        .toReversed()
        .map((e) => 1 - e),
    )
      .toReversed()
      .map((e) => 1 - e),
  ];
};

export const BATCH_EIGHT_READINGS: Readonly<Record<string, Reading>> = {
  "WachsWhite@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromGamma(arcs(bl), size(bl)));
  },
  "InverseWachsWhite@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromArcs(toGamma(bl), size(bl)));
  },
  "WachsWhiteRho@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromRho(arcs(bl), size(bl)));
  },
  "InverseWachsWhiteRho@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromArcs(toRho(bl), size(bl)));
  },
  "CoriLeBorgne@DyckPath": (d) => list(coriLeBorgne(ints(d))),
  "ElizaldeDeutsch@DyckPath": (d) => list(elizaldeDeutsch(ints(d))),
  "BarnabeiCastronuovo@DyckPath": (d) => list(barnabeiCastronuovo(ints(d))),
  "Yip@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromPsi(arcs(bl), size(bl)));
  },
  "InverseYip@SetPartition": (s) => {
    const bl = blocks(s);
    return blocksText(fromArcs(toPsi(bl), size(bl)));
  },
};
