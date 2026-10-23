// Independent readings of the maps adopted from FindStat, written against FindStat's own
// descriptions (rotate, complement, left-to-right maxima, …) rather than against our Epsil bodies.
// Each reads FindStat's TEXT for an object and returns FindStat's text for the image, so a reading
// is held to the crawl's MapData as exact strings, and an engine result is read back to text the
// same way. Keyed `Head@Carrier`, the carrier being the map's source.

export type Reading = (text: string) => string;

const ints = (text: string): number[] => JSON.parse(text) as number[];
const list = (items: readonly number[]): string => `[${items.join(",")}]`;
const rows = (text: string): number[][] => JSON.parse(text) as number[][];
const rowsText = (items: readonly (readonly number[])[]): string => `[${items.map(list).join(",")}]`;
const sum = (items: readonly number[]): number => items.reduce((a, b) => a + b, 0);
const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
const descending = (items: readonly number[]): number[] => items.toSorted((a, b) => b - a);

/** A composition's cut set: the partial sums short of its size. */
const cuts = (parts: readonly number[]): Set<number> => {
  const out = new Set<number>();
  let total = 0;
  for (const part of parts.slice(0, -1)) out.add((total += part));
  return out;
};
/** The composition of n whose cut set is `cutSet`: the gaps between successive cuts. */
const fromCuts = (n: number, cutSet: ReadonlySet<number>): number[] => {
  const bounds = [0, ...[...cutSet].toSorted((a, b) => a - b), n];
  return bounds.slice(1).map((bound, k) => bound - bounds[k]!);
};
const complementComposition = (parts: readonly number[]): number[] => {
  const n = sum(parts);
  if (n === 0) return [];
  const mine = cuts(parts);
  return fromCuts(n, new Set(range(1, n - 1).filter((k) => !mine.has(k))));
};

/** `{{1,3},{2}}`: the blocks of a set partition, each sorted, ordered by least element. */
const blocks = (text: string): number[][] =>
  (JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][])
    .map((block) => block.toSorted((a, b) => a - b))
    .toSorted((a, b) => a[0]! - b[0]!);
const blocksText = (items: readonly (readonly number[])[]): string =>
  `{${items.map((block) => `{${block.join(",")}}`).join(",")}}`;

/** Each up step's height before it (the area sequence), for a Dyck word of 1s and 0s. */
const areaSequence = (word: readonly number[]): number[] => {
  const out: number[] = [];
  let height = 0;
  for (const step of word) {
    if (step === 1) out.push(height);
    height += step === 1 ? 1 : -1;
  }
  return out;
};

export const MAP_READINGS: Readonly<Record<string, Reading>> = {
  // Binary words are strings of 0s and 1s.
  "Reverse@BinaryWord": (w) => w.split("").toReversed().join(""),
  "Complement@BinaryWord": (w) =>
    w
      .split("")
      .map((letter) => (letter === "0" ? "1" : "0"))
      .join(""),
  "CyclicShift@BinaryWord": (w) => w.slice(1) + w.slice(0, 1),
  "InverseCyclicShift@BinaryWord": (w) => w.slice(-1) + w.slice(0, -1),

  "Reverse@Composition": (c) => list(ints(c).toReversed()),
  "Complement@Composition": (c) => list(complementComposition(ints(c))),
  // FindStat: the conjugate is the complement of the reversal.
  "TransposeComposition@Composition": (c) => list(complementComposition(ints(c).toReversed())),
  "CyclicShift@Composition": (c) => list([...ints(c).slice(1), ...ints(c).slice(0, 1)]),
  "InverseCyclicShift@Composition": (c) => list([...ints(c).slice(-1), ...ints(c).slice(0, -1)]),
  "SortedPartition@Composition": (c) => list(descending(ints(c))),

  // Replace i by n + 1 - i, as FindStat's sage code does.
  "Complement@SetPartition": (p) => {
    const parts = blocks(p);
    const n = sum(parts.map((block) => block.length));
    return blocksText(blocks(blocksText(parts.map((block) => block.map((x) => n + 1 - x)))));
  },
  "BlockSizePartition@SetPartition": (p) => list(descending(blocks(p).map((block) => block.length))),
  "TableauShape@StandardTableau": (t) => list(rows(t).map((row) => row.length)),
  "TransposeTableau@StandardTableau": (t) => {
    const table = rows(t);
    return rowsText(
      range(0, (table[0]?.length ?? 0) - 1).map((j) => table.flatMap((row) => (j < row.length ? [row[j]!] : []))),
    );
  },

  // Letter i: whether the word falls between positions i and i + 1.
  "DescentWord@Permutation": (p) => {
    const w = ints(p);
    return w
      .slice(1)
      .map((value, k) => (w[k]! > value ? "1" : "0"))
      .join("");
  },
  // Value v is a descent top when the entry right after it is smaller; the word starts at v = 2.
  "DescentTopWord@Permutation": (p) => {
    const w = ints(p);
    const tops = new Set(w.flatMap((value, k) => (k + 1 < w.length && w[k + 1]! < value ? [value] : [])));
    return range(2, w.length)
      .map((v) => (tops.has(v) ? "1" : "0"))
      .join("");
  },
  // Value v is a descent bottom when the entry right before it is larger; the word stops at n - 1.
  "DescentBottomWord@Permutation": (p) => {
    const w = ints(p);
    const bottoms = new Set(w.flatMap((value, k) => (k > 0 && w[k - 1]! > value ? [value] : [])));
    return range(1, w.length - 1)
      .map((v) => (bottoms.has(v) ? "1" : "0"))
      .join("");
  },
  // c⁻¹πc: in cycle notation, 1 is added (mod n) to every element of every cycle.
  "LongCycleConjugation@Permutation": (p) => {
    const w = ints(p);
    const n = w.length;
    const up = (v: number): number => (v % n) + 1;
    const image = new Array<number>(n);
    w.forEach((value, k) => (image[up(k + 1) - 1] = up(value)));
    return list(image);
  },

  "ReverseComplement@DyckPath": (d) =>
    list(
      ints(d)
        .toReversed()
        .map((step) => 1 - step),
    ),
  "BinaryWord@DyckPath": (d) => ints(d).join(""),
  // The returns to the diagonal cut the path into primitive pieces; the parts are their semilengths.
  "TouchComposition@DyckPath": (d) => {
    const parts: number[] = [];
    let height = 0;
    let since = 0;
    for (const step of ints(d)) {
      height += step === 1 ? 1 : -1;
      since++;
      if (height === 0) {
        parts.push(since / 2);
        since = 0;
      }
    }
    return list(parts);
  },
  "RiseComposition@DyckPath": (d) => {
    const parts: number[] = [];
    let previous = 0;
    for (const step of ints(d)) {
      if (step === 1) {
        if (previous === 1) parts[parts.length - 1]!++;
        else parts.push(1);
      }
      previous = step;
    }
    return list(parts);
  },
  // Sage's construction: rank the ups and the downs, keep the ranks of those that start a double rise or fall,
  // and read the image's ascent and descent lengths off consecutive differences, each list closed by n.
  "LalanneKreweras@DyckPath": (d) => {
    const word = ints(d);
    const n = word.length / 2;
    const doubleRiseRanks: number[] = [];
    const doubleFallRanks: number[] = [];
    let ups = 0;
    let downs = 0;
    for (let i = 0; i + 1 < word.length; i++) {
      if (word[i] === 1) {
        ups++;
        if (word[i + 1] === 1) doubleRiseRanks.push(ups);
      } else {
        downs++;
        if (word[i + 1] === 0) doubleFallRanks.push(downs);
      }
    }
    const ascents = [0, ...doubleFallRanks, n];
    const descents = [0, ...doubleRiseRanks, n];
    const image: number[] = [];
    for (let i = 1; i < ascents.length; i++) {
      image.push(...Array<number>(ascents[i]! - ascents[i - 1]!).fill(1));
      image.push(...Array<number>(descents[i]! - descents[i - 1]!).fill(0));
    }
    return list(image);
  },
  // Sage's description: walk the levels of the reversed area sequence from the top down to -1.
  "ZetaMap@DyckPath": (d) => {
    const area = areaSequence(ints(d)).toReversed();
    const image: number[] = [];
    for (let level = Math.max(...area, -1); level >= -1; level--)
      for (const entry of area) {
        if (entry === level) image.push(1);
        else if (entry === level + 1) image.push(0);
      }
    return list(image);
  },
};

export { descending, ints, list, range, rows, rowsText, sum };
