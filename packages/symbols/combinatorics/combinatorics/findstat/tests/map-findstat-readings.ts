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

/** A binary tree as FindStat writes it: `.` is empty, `[L,R]` a node. */
type Tree = null | readonly [Tree, Tree];
const parseTree = (text: string): Tree => {
  let at = 0;
  const tree = (): Tree => {
    if (text[at] === ".") {
      at++;
      return null;
    }
    at++; // [
    const l = tree();
    at++; // ,
    const r = tree();
    at++; // ]
    return [l, r];
  };
  return tree();
};
const treeText = (t: Tree): string => (t === null ? "." : `[${treeText(t[0])},${treeText(t[1])}]`);
/** Mp00018: a tree's left border is the chain of nodes down the left spine; reverse the right subtrees along it. */
const leftBorderSymmetry = (t: Tree): Tree => {
  const rights: Tree[] = [];
  for (let node = t; node !== null; node = node[0]) rights.push(node[1]);
  // The deepest node of the new chain holds the first right subtree; the top node, the last.
  const build = (rest: readonly Tree[]): Tree =>
    rest.length === 0 ? null : [build(rest.slice(1)), leftBorderSymmetry(rest[0]!)];
  return build(rights.toReversed());
};

/** A permutation's Lehmer code: entry i counts the later entries below entry i. */
const lehmer = (w: readonly number[]): number[] => w.map((x, i) => w.slice(i + 1).filter((y) => y < x).length);
/** The permutation with Lehmer code `code`. */
const fromLehmer = (code: readonly number[]): number[] => {
  const free = range(1, code.length);
  return code.map((c) => free.splice(c, 1)[0]!);
};
const major = (w: readonly number[]): number =>
  sum(w.flatMap((x, k) => (k + 1 < w.length && x > w[k + 1]! ? [k + 1] : [])));
/** Mp00062's major code: entry i is maj(w without values below i) - maj(w without values below i + 1). */
const majorCode = (w: readonly number[]): number[] =>
  w.map((_, k) => major(w.filter((x) => x >= k + 1)) - major(w.filter((x) => x >= k + 2)));
const permutationsOf = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutationsOf(n - 1).flatMap((rest) =>
        range(0, rest.length).map((i) => [...rest.slice(0, i), n, ...rest.slice(i)]),
      );
const byMajorCode = new Map<number, Map<string, number[]>>();
/** The permutation of its size with major code `code`, found by trying them all. */
const fromMajorCode = (code: readonly number[]): number[] => {
  const n = code.length;
  if (!byMajorCode.has(n)) byMajorCode.set(n, new Map(permutationsOf(n).map((w) => [majorCode(w).join(","), w])));
  return byMajorCode.get(n)!.get(code.join(","))!;
};

const dyckWords = (n: number): number[][] =>
  n === 0
    ? [[]]
    : range(0, n - 1).flatMap((k) =>
        dyckWords(k).flatMap((inside) => dyckWords(n - 1 - k).map((after) => [1, ...inside, 0, ...after])),
      );
const byZeta = new Map<number, Map<string, number[]>>();
/** Mp00032: the Dyck path whose zeta image is `image`, found by trying them all. */
const inverseZeta = (image: readonly number[]): number[] => {
  const n = image.length / 2;
  if (!byZeta.has(n))
    byZeta.set(n, new Map(dyckWords(n).map((d) => [ints(MAP_READINGS["ZetaMap@DyckPath"]!(list(d))).join(","), d])));
  return byZeta.get(n)!.get(image.join(","))!;
};
/** Mp00101: 1 D1 0 D2 with D1 shortest becomes 1 D2' 0 D1'. */
const decompositionReverse = (word: readonly number[]): number[] => {
  if (word.length === 0) return [];
  let height = 0;
  let close = 0;
  for (const [k, step] of word.entries()) {
    height += step === 1 ? 1 : -1;
    if (height === 0) {
      close = k;
      break;
    }
  }
  return [1, ...decompositionReverse(word.slice(close + 1)), 0, ...decompositionReverse(word.slice(1, close))];
};

/** Mp00086 and the other word-to-cycles readings: the stretches between successive left-to-right maxima. */
const maximaStretches = (w: readonly number[]): number[][] => {
  const out: number[][] = [];
  let top = 0;
  for (const x of w) {
    if (x > top) {
      out.push([]);
      top = x;
    }
    out[out.length - 1]!.push(x);
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
  // π⁻¹c, Sage's left-to-right product: π⁻¹ first, then the long cycle c(x) = x + 1 (n back to 1).
  "KrewerasComplement@Permutation": (p) => {
    const w = ints(p);
    const n = w.length;
    const inverse = new Array<number>(n);
    w.forEach((value, k) => (inverse[value - 1] = k + 1));
    return list(inverse.map((v) => (v % n) + 1));
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
  // Mp00032 is the inverse of the zeta map: the path whose zeta image this is.
  "InverseZetaMap@DyckPath": (d) => list(inverseZeta(ints(d))),
  // Sage's decomposition: the first return cuts the path as 1 D1 0 D2.
  "DecompositionReverse@DyckPath": (d) => list(decompositionReverse(ints(d))),
  "PrimeDyckPath@DyckPath": (d) => list([1, ...ints(d), 0]),
  // Walk the lattice path: from (n, n) west to the vertical step of the path that ends at that height, south to
  // the diagonal, and on; the bounce path climbs to each stop in turn and returns to the diagonal.
  "BouncePath@DyckPath": (d) => {
    const word = ints(d);
    const n = word.length / 2;
    const verticals: [column: number, from: number][] = [];
    let x = 0;
    let y = 0;
    for (const step of word) {
      if (step === 1) verticals.push([x, y++]);
      else x++;
    }
    const stops = [n];
    for (let stop = n; stop > 0;) {
      stop = verticals.find(([, from]) => from + 1 === stop)![0];
      stops.push(stop);
    }
    const ascending = stops.toReversed();
    return list(
      ascending.slice(1).flatMap((stop, k) => {
        const gap = stop - ascending[k]!;
        return [...Array<number>(gap).fill(1), ...Array<number>(gap).fill(0)];
      }),
    );
  },

  "Mirror@BinaryTree": (t) => {
    const mirror = (x: Tree): Tree => (x === null ? null : [mirror(x[1]), mirror(x[0])]);
    return treeText(mirror(parseTree(t)));
  },
  // Sage: a root with no right child has nothing to pull up, so it swaps its children instead.
  "LeftRotation@BinaryTree": (t) => {
    const tree = parseTree(t);
    if (tree === null) return ".";
    const [a, right] = tree;
    return treeText(right === null ? [right, a] : [[a, right[0]], right[1]]);
  },
  "RightRotation@BinaryTree": (t) => {
    const tree = parseTree(t);
    if (tree === null) return ".";
    const [left, c] = tree;
    return treeText(left === null ? [c, left] : [left[0], [left[1], c]]);
  },
  "LeftBorderSymmetry@BinaryTree": (t) => treeText(leftBorderSymmetry(parseTree(t))),

  // The cycles are the stretches between left-to-right maxima; each entry goes to the next in its cycle.
  "InverseFoata@Permutation": (p) => {
    const image: number[] = [];
    for (const cycle of maximaStretches(ints(p)))
      cycle.forEach((x, k) => (image[x - 1] = cycle[(k + 1) % cycle.length]!));
    return list(image);
  },
  // c π⁻¹ in Sage's left-to-right product: c first, then π⁻¹.
  "InverseKrewerasComplement@Permutation": (p) => {
    const w = ints(p);
    const n = w.length;
    const inverse = new Array<number>(n);
    w.forEach((value, k) => (inverse[value - 1] = k + 1));
    return list(range(1, n).map((i) => inverse[i % n]!));
  },
  "LehmerCodeToMajorCode@Permutation": (p) => list(fromMajorCode(lehmer(ints(p)))),
  "MajorCodeToLehmerCode@Permutation": (p) => list(fromLehmer(majorCode(ints(p)))),
  "LehmerCodeRotation@Permutation": (p) => {
    const code = lehmer(ints(p));
    return list(fromLehmer(code.map((c, i) => (c + 1) % (code.length - i))));
  },
  // The connectivity set: i with every one of the first i entries below every later one.
  "ConnectivityWord@Permutation": (p) => {
    const w = ints(p);
    return range(1, w.length - 1)
      .map((i) => (w.slice(0, i).every((a) => w.slice(i).every((b) => a < b)) ? "1" : "0"))
      .join("");
  },
  // Sage's construction: the left-to-right maxima as points (position, value), each bridged by a rise and a fall.
  "LeftToRightMaximaDyckPath@Permutation": (p) => {
    const w = ints(p);
    const points: [number, number][] = [[0, 0]];
    w.forEach((value, k) => {
      if (value > points.at(-1)![1]) points.push([k, value]);
    });
    points.push([w.length, w.length]);
    const word: number[] = [];
    for (let k = 0; k + 2 < points.length; k++) {
      word.push(...Array<number>(points[k + 1]![1] - points[k]![1]).fill(1));
      word.push(...Array<number>(points[k + 2]![0] - points[k + 1]![0]).fill(0));
    }
    return list(word);
  },

  "RunComposition@BinaryWord": (w) => list((w.match(/0+|1+/g) ?? []).map((run) => run.length)),
  "Twist@BinaryWord": (w) => (w === "" ? "" : (w[0] === "0" ? "1" : "0") + w.slice(1)),
  "AlternatingComplement@BinaryWord": (w) =>
    w
      .split("")
      .map((letter, k) => (k % 2 === 1 ? (letter === "0" ? "1" : "0") : letter))
      .join(""),

  // Sage: add 1 to every entry but the largest, which becomes 1.
  "IncreasingRotation@SetPartition": (p) => {
    const parts = blocks(p);
    const n = sum(parts.map((block) => block.length));
    return blocksText(blocks(blocksText(parts.map((block) => block.map((x) => (x % n) + 1)))));
  },
  "DecreasingRotation@SetPartition": (p) => {
    const parts = blocks(p);
    const n = sum(parts.map((block) => block.length));
    return blocksText(blocks(blocksText(parts.map((block) => block.map((x) => (x > 1 ? x - 1 : n))))));
  },
  "BlockSizeComposition@SetPartition": (p) => list(blocks(p).map((block) => block.length)),

  "TableauDescentWord@StandardTableau": (t) => {
    const table = rows(t);
    const rowOf = (v: number): number => table.findIndex((row) => row.includes(v));
    const n = sum(table.map((row) => row.length));
    return range(1, n - 1)
      .map((i) => (rowOf(i + 1) > rowOf(i) ? "1" : "0"))
      .join("");
  },
  // Bottom row first, each row left to right.
  "ReadingWord@StandardTableau": (t) => list(rows(t).toReversed().flat()),
  "PeakComposition@StandardTableau": (t) =>
    list(tableauComposition(rows(t), (descent, i) => descent(i) && !descent(i - 1))),
  "ValleyComposition@StandardTableau": (t) =>
    list(tableauComposition(rows(t), (descent, i) => descent(i - 1) && !descent(i))),
};

/** The composition of n cut at the entries i in 2 .. n - 1 for which `pick` holds, given whether entry i is a descent. */
function tableauComposition(
  table: readonly (readonly number[])[],
  pick: (descent: (i: number) => boolean, i: number) => boolean,
): number[] {
  const rowOf = (v: number): number => table.findIndex((row) => row.includes(v));
  const n = sum(table.map((row) => row.length));
  const descent = (i: number): boolean => rowOf(i + 1) > rowOf(i);
  const cuts = range(2, n - 1).filter((i) => pick(descent, i));
  const bounds = [0, ...cuts, n];
  return bounds.slice(1).map((bound, k) => bound - bounds[k]!);
}

export { descending, ints, list, range, rows, rowsText, sum };
