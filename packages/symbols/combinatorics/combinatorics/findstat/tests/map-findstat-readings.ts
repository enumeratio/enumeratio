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

/** Mp00067, as FindStat describes it: put each new letter on the end of the image so far, put a line after every
 *  letter it is at least (when it is at least the last letter) or below (when it is below), and rotate each block right. */
const foataBijection = (w: readonly number[]): number[] => {
  let image = w.slice(0, 1);
  for (const x of w.slice(1)) {
    const last = image.at(-1)!;
    const lines = image.map((v) => (x >= last ? x >= v : x < v));
    const word = [...image, x];
    const blocks: number[][] = [[]];
    word.forEach((letter, k) => {
      blocks.at(-1)!.push(letter);
      if (k >= image.length || lines[k]) blocks.push([]);
    });
    image = blocks.filter((block) => block.length > 0).flatMap((block) => [block.at(-1)!, ...block.slice(0, -1)]);
  }
  return image;
};
const byFoata = new Map<number, Map<string, number[]>>();
/** Mp00175: the permutation whose Foata image this is, found by trying them all. */
const inverseFoataBijection = (image: readonly number[]): number[] => {
  const n = image.length;
  if (!byFoata.has(n)) byFoata.set(n, new Map(permutationsOf(n).map((w) => [foataBijection(w).join(","), w])));
  return byFoata.get(n)!.get(image.join(","))!;
};

/** Jeu de taquin on tableaux as arrays of rows. A hole slides outward (`forward`) by swapping with the smaller of
 *  its right and lower neighbours, or inward by swapping with the larger of its left and upper ones; the cell it ends in
 *  is returned. */
type Cell = [row: number, column: number];
const slide = (table: number[][], from: Cell, forward: boolean): Cell => {
  let [r, c] = from;
  for (;;) {
    const options: Cell[] = forward
      ? [
          [r, c + 1],
          [r + 1, c],
        ]
      : [
          [r, c - 1],
          [r - 1, c],
        ];
    const inside = options.filter(([i, j]) => table[i]?.[j] !== undefined);
    if (inside.length === 0) return [r, c];
    const [i, j] = inside.reduce((a, b) => (forward === table[a[0]]![a[1]]! < table[b[0]]![b[1]]! ? a : b));
    table[r]![c] = table[i]![j]!;
    [r, c] = [i, j];
  }
};
const cellOf = (table: readonly (readonly number[])[], value: number): Cell => {
  const r = table.findIndex((row) => row.includes(value));
  return [r, table[r]!.indexOf(value)];
};
/** Sage's promotion (Mp00155): the largest entry becomes a hole that slides to the origin, and every entry goes up by one. */
const promotionOf = (t: readonly (readonly number[])[]): number[][] => {
  const table = t.map((row) => [...row]);
  const n = sum(table.map((row) => row.length));
  const [r, c] = cellOf(table, n);
  table[r]![c] = 0;
  const [i, j] = slide(table, [r, c], false);
  table[i]![j] = 0;
  return table.map((row) => row.map((x) => x + 1));
};
/** Sage's inverse promotion (Mp00153): the entry 1 becomes a hole that slides out, and every entry goes down by one. */
const inversePromotionOf = (t: readonly (readonly number[])[]): number[][] => {
  const table = t.map((row) => [...row]);
  const n = sum(table.map((row) => row.length));
  const [i, j] = slide(table, [0, 0], true);
  table[i]![j] = n + 1;
  return table.map((row) => row.map((x) => x - 1));
};
/** Schützenberger's involution (Mp00085): take out the smallest entry, slide the rest in, and write the next largest
 *  label in the cell that empties. */
const evacuationOf = (t: readonly (readonly number[])[]): number[][] => {
  const table = t.map((row) => [...row]);
  const result = t.map((row) => row.map(() => 0));
  for (let label = sum(table.map((row) => row.length)); label >= 1; label--) {
    const [r, c] = slide(table, [0, 0], true);
    result[r]![c] = label;
    table[r]!.pop();
    if (table[r]!.length === 0) table.pop();
    for (const row of table) row.forEach((x, k) => (row[k] = x - 1));
  }
  return result;
};
/** Row insertion of `word`, recording where each cell appears; and its inverse, bumping back out. */
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
const inverseRskPair = (pTable: readonly (readonly number[])[], qTable: readonly (readonly number[])[]): number[] => {
  const p = pTable.map((row) => [...row]);
  const q = qTable.map((row) => [...row]);
  const word: number[] = [];
  for (let k = sum(q.map((row) => row.length)); k >= 1; k--) {
    const r = q.findIndex((row) => row.at(-1) === k);
    q[r]!.pop();
    let x = p[r]!.pop()!;
    for (let above = r - 1; above >= 0; above--) {
      const at = p[above]!.findLastIndex((y) => y < x);
      [x, p[above]![at]] = [p[above]![at]!, x];
    }
    word.unshift(x);
    if (p[r]!.length === 0) {
      p.pop();
      q.pop();
    }
  }
  return word;
};
/** Mp00222, as Sage writes it. */
const peaksToValleys = (d: readonly number[]): number[] => {
  let h = 0;
  const peaks: [number, number][] = [[-2, 0]];
  for (let i = 0; i < d.length - 1; i++) {
    if (d[i] === 1) {
      if (d[i + 1] === 0 && h > 0) peaks.push([i, h]);
      h++;
    } else h--;
  }
  peaks.push([d.length, 0]);
  const out: number[] = [];
  for (let k = 0; k + 1 < peaks.length; k++) {
    const [i0, h0] = peaks[k]!;
    const [i1, h1] = peaks[k + 1]!;
    const a = Math.floor((i1 - i0 - 2 + h1 - h0) / 2);
    const b = Math.floor((i1 - i0 - 2 - (h1 - h0)) / 2);
    out.push(...Array<number>(a).fill(1), ...Array<number>(b).fill(0), 0, 1);
  }
  return out.slice(0, -2);
};
/** The two-row tableau of a Dyck word (up steps in the first row), promoted by `step`, as a word again. */
const throughTwoRows = (d: readonly number[], step: (t: number[][]) => number[][]): number[] => {
  const table = [range(1, d.length).filter((p) => d[p - 1] === 1), range(1, d.length).filter((p) => d[p - 1] === 0)];
  const first = new Set(step(table)[0]);
  return range(1, d.length).map((p) => (first.has(p) ? 1 : 0));
};

/** Sage's runsort (Mp00223, Mp00224): the weakly increasing runs, sorted as Python sorts lists of numbers. */
const runSort = (w: readonly number[]): number[] => {
  const runs: number[][] = [];
  let run: number[] = [];
  w.forEach((letter, k) => {
    if (k > 0 && w[k - 1]! > letter) {
      runs.push(run);
      run = [];
    }
    run.push(letter);
  });
  if (run.length > 0) runs.push(run);
  const compare = (a: readonly number[], b: readonly number[]): number => {
    for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) return a[k]! - b[k]!;
    return a.length - b.length;
  };
  return runs.toSorted(compare).flat();
};

/** `[{1,3},{2}]`: the blocks of an ordered set partition, in order. */
const orderedBlocks = (text: string): number[][] =>
  (JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][]).map((block) =>
    block.toSorted((a, b) => a - b),
  );
const orderedBlocksText = (items: readonly (readonly number[])[]): string =>
  `[${items.map((block) => `{${block.join(",")}}`).join(",")}]`;

/** An ordered tree as FindStat writes it: a vertex is the list of its children. */
type Plane = readonly Plane[];
const planeText = (t: Plane): string => `[${t.map(planeText).join(",")}]`;
/** Sage's to_ordered_tree_left_branch: down the left spine, each node's converted right subtree becomes a child,
 *  the deepest node's first. */
const orderedLeftBranch = (t: Tree): Plane => {
  const children: Plane[] = [];
  for (let node = t; node !== null; node = node[0]) children.unshift(orderedLeftBranch(node[1]));
  return children;
};
/** Sage's to_ordered_tree_right_branch: down the right spine, each node's converted left subtree is a child. */
const orderedRightBranch = (t: Tree): Plane => {
  const children: Plane[] = [];
  for (let node = t; node !== null; node = node[1]) children.push(orderedRightBranch(node[0]));
  return children;
};
/** Sage's to_binary_tree_left_branch: the children from first to last, each a node whose left child is the one before. */
const binaryLeftBranch = (t: Plane): Tree => {
  let tree: Tree = null;
  for (const child of t) tree = [tree, binaryLeftBranch(child)];
  return tree;
};
/** Sage's to_binary_tree_right_branch: the children from last to first, each a node whose right child is the one after. */
const binaryRightBranch = (t: Plane): Tree => {
  let tree: Tree = null;
  for (const child of t.toReversed()) tree = [binaryRightBranch(child), tree];
  return tree;
};
const mirrorPlane = (t: Plane): Plane => t.map(mirrorPlane).toReversed();
/** Mp00246, as Sage writes it: the branch decomposition down the first-child spine, rebuilt bottom to top. */
const rotatePlane = (t: Plane): Plane => {
  const branches: (readonly Plane[])[] = [];
  for (let s: Plane = t; s.length > 0; s = s[0]!) branches.push(s.slice(1));
  let r: Plane = [];
  for (const branch of branches) r = [...branch, r];
  return r;
};
/** The Dyck word of a plane tree's depth-first contour. */
const contour = (t: Plane): number[] => t.flatMap((child) => [1, ...contour(child), 0]);

/** A binary word's text `0110` as letters, and back. */
const letters = (text: string): number[] => (text === "" ? [] : text.split("").map(Number));
const wordText = (items: readonly number[]): string => items.join("");

/** Mp00272, as Sage writes it. */
const grayNext = (w: number[]): number[] => {
  if (w.length === 0) return w;
  const out = [...w];
  if (sum(w) % 2 === 0) {
    out[0] = 1 - out[0]!;
    return out;
  }
  const i = out.indexOf(1);
  if (i + 1 === out.length) return out.map(() => 0);
  out[i + 1] = 1 - out[i + 1]!;
  return out;
};

/** Mp00273, as Sage writes it. */
const grayPrevious = (w: number[]): number[] => {
  if (w.length === 0) return w;
  const out = [...w];
  if (sum(w) % 2 === 1) {
    out[0] = 1 - out[0]!;
    return out;
  }
  const i = out.indexOf(1);
  if (i < 0) {
    out[out.length - 1] = 1;
    return out;
  }
  out[i + 1] = 1 - out[i + 1]!;
  return out;
};

/** Mp00234: each valley 01 becomes a peak 10, and a trailing 0 a 1. */
const valleysToPeaks = (w: number[]): number[] => {
  const out = [...w];
  for (let i = 0; i + 1 < w.length; i++) if (w[i] === 0 && w[i + 1] === 1) [out[i], out[i + 1]] = [1, 0];
  if (w[w.length - 1] === 0) out[w.length - 1] = 1;
  return out;
};

/** Mp00278, as Sage writes it: factors between valleys are reversed and each valley becomes 10. */
const rowmotion = (w: number[]): number[] => {
  if (w.length <= 1) return w;
  const out: number[] = [];
  let factor: number[] = [];
  let i = 0;
  while (i < w.length) {
    if (i + 1 < w.length && !w[i] && w[i + 1]) {
      out.push(...factor.toReversed());
      factor = [];
      out.push(1, 0);
      i += 2;
    } else {
      factor.push(w[i]!);
      i++;
    }
  }
  out.push(...factor.toReversed());
  return out;
};

/** Mp00280, as Sage writes it. */
const pathRowmotion = (w: number[]): number[] => {
  const n = w.length;
  const out: number[] = [];
  let a = 0;
  let i = 0;
  while (i < n) {
    if (w[i]) {
      a++;
      i++;
    } else if (i + 1 === n) {
      out.push(...Array.from({ length: a + 1 }, () => 1));
      i += 2;
      a = 0;
    } else if (w[i + 1]) {
      out.push(...Array.from({ length: a + 1 }, () => 1), 0);
      i += 2;
      a = 0;
    } else {
      out.push(0);
      i++;
    }
  }
  out.push(...Array.from({ length: a }, () => 0));
  return out;
};

/** Mp00268, as Sage writes it. */
const zerosToFlagZeros = (w: number[]): number[] => {
  const n = w.length;
  const zeroAt = [-1, ...range(0, n - 1).filter((k) => w[k] === 0)];
  const gaps = range(1, zeroAt.length - 1).map((k) => zeroAt[k]! - zeroAt[k - 1]! - 1);
  const out: number[] = [];
  let letter = 1;
  for (const b of gaps) {
    out.push(...Array.from({ length: b }, () => letter));
    if (letter === 0) out.push(0, 1);
    letter = 1 - letter;
  }
  out.push(...Array.from({ length: n - out.length }, () => letter));
  return out.toReversed();
};

/** Mp00269, as Sage writes it. */
const flagZerosToZeros = (w: number[]): number[] => {
  const zeros: number[] = [];
  let letter = 1;
  let z = 0;
  for (const e of w.toReversed()) {
    if (e === letter) z++;
    else {
      zeros.push(z);
      z = 0;
      letter = 1 - letter;
    }
  }
  const out = w.map(() => 1);
  let last = -1;
  for (const gap of zeros) {
    last = gap + last + 1;
    out[last] = 0;
  }
  return out;
};

/** The distinct rearrangements of a word's letters. */
const rearrangements = (w: readonly number[]): number[][] => {
  if (w.length === 0) return [[]];
  return [...new Set(w)].flatMap((x) => {
    const rest = [...w];
    rest.splice(rest.indexOf(x), 1);
    return rearrangements(rest).map((tail) => [x, ...tail]);
  });
};
/** The word whose Foata image is `image`, found by trying every rearrangement of its letters. */
const inverseFoataWord = (image: readonly number[]): number[] =>
  rearrangements(image).find((w) => foataBijection(w).join(",") === image.join(","))!;

/** The heights of a Dyck word after each prefix, the empty one first. */
const heightsOf = (d: readonly number[]): number[] => {
  const out = [0];
  for (const step of d) out.push(out.at(-1)! + (step === 1 ? 1 : -1));
  return out;
};

/** Mp00103, as Sage writes it: the area sequence moves left, entries drop by two (to at least 0) and a 0 closes it. */
const peeling = (d: readonly number[]): number[] => {
  const area = areaSequence(d);
  const peeled = area.slice(1).map((a) => Math.max(a - 2, 0));
  peeled.push(0);
  // The Dyck word with this area sequence: each entry is the height before its up step.
  const word: number[] = [];
  let height = 0;
  for (const a of peeled) {
    while (height > a) {
      word.push(0);
      height--;
    }
    word.push(1);
    height++;
  }
  return [...word, ...Array.from({ length: height }, () => 0)];
};

/** Mp00330, as Sage writes it. */
const rotateClockwise = (d: readonly number[]): number[] => {
  if (d.length === 0) return [];
  const heights = heightsOf(d);
  const k = d.indexOf(0);
  const out = [...d];
  const inserts = range(1, k - 1).map((i) => range(k, heights.length - 1).find((j) => heights[j]! < i)!);
  for (const j of inserts) out.splice(j, 0, 1);
  return [1, ...out.slice(k + 1), 0];
};

/** Mp00331, as Sage writes it. */
const rotateCounterclockwise = (d: readonly number[]): number[] => {
  const heights = heightsOf(d);
  const returns = heights.filter((h) => h === 0).length - 1;
  const zeros = heights.flatMap((h, j) => (h === 0 ? [j] : []));
  const out = [...d];
  for (const j of zeros.slice(0, -1).toReversed()) out.splice(j, 1);
  return [...Array.from({ length: returns }, () => 1), 0, ...out].slice(0, -1);
};

/** Mp00106, as the description has it: take the first row off, then column-insert its entries, largest first. A tableau
 *  is held as columns, each increasing; inserting k into a column bumps the least entry above k into the next column. */
const catabolism = (table: readonly (readonly number[])[]): number[][] => {
  const [first, ...rest] = table;
  const columns: number[][] = range(0, Math.max(0, ...rest.map((row) => row.length)) - 1).map((c) =>
    rest.filter((row) => row.length > c).map((row) => row[c]!),
  );
  for (const k of first!.toReversed()) {
    let carried = k;
    for (let c = 0; ; c++) {
      const column = (columns[c] ??= []);
      const bumped = column.find((entry) => entry > carried);
      if (bumped === undefined) {
        column.push(carried);
        break;
      }
      column[column.indexOf(bumped)] = carried;
      carried = bumped;
    }
  }
  return range(0, Math.max(...columns.map((column) => column.length)) - 1).map((r) =>
    columns.filter((column) => column.length > r).map((column) => column[r]!),
  );
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

  // A binary tree [L, R] and an ordered tree with one more vertex: the left or the right spine becomes the children.
  "OrderedTree@BinaryTree": (t) => planeText(orderedLeftBranch(parseTree(t))),
  "RightBranchOrderedTree@BinaryTree": (t) => planeText(orderedRightBranch(parseTree(t))),
  "BinaryTree@OrderedTree": (t) => treeText(binaryLeftBranch(JSON.parse(t) as Plane)),
  "RightBranchBinaryTree@OrderedTree": (t) => treeText(binaryRightBranch(JSON.parse(t) as Plane)),
  "Mirror@OrderedTree": (t) => planeText(mirrorPlane(JSON.parse(t) as Plane)),
  "Rotation@OrderedTree": (t) => planeText(rotatePlane(JSON.parse(t) as Plane)),
  "DyckPath@OrderedTree": (t) => list(contour(JSON.parse(t) as Plane)),
  "OrderedTree@DyckPath": (d) => {
    const stack: Plane[][] = [[]];
    for (const step of ints(d)) {
      if (step === 1) stack.push([]);
      else {
        const done = stack.pop()!;
        stack.at(-1)!.push(done);
      }
    }
    return planeText(stack[0]!);
  },
  // Mp00328 is the right-branch bijection followed by the left-branch one back.
  "DeBruijnMorselt@OrderedTree": (t) => planeText(orderedLeftBranch(binaryRightBranch(JSON.parse(t) as Plane))),

  "Reverse@SetComposition": (p) => orderedBlocksText(orderedBlocks(p).toReversed()),
  "Complement@SetComposition": (p) => {
    const parts = orderedBlocks(p);
    const n = sum(parts.map((block) => block.length));
    return orderedBlocksText(parts.map((block) => block.map((x) => n + 1 - x).toSorted((a, b) => a - b)));
  },
  "CyclicShift@SetComposition": (p) => {
    const parts = orderedBlocks(p);
    return orderedBlocksText([...parts.slice(1), ...parts.slice(0, 1)]);
  },
  "InverseCyclicShift@SetComposition": (p) => {
    const parts = orderedBlocks(p);
    return orderedBlocksText([...parts.slice(-1), ...parts.slice(0, -1)]);
  },
  "RunSort@Permutation": (p) => list(runSort(ints(p))),
  "RunSort@BinaryWord": (w) => runSort(w.split("").map(Number)).join(""),
  "Evacuation@StandardTableau": (t) => rowsText(evacuationOf(rows(t))),
  "TableauPromotion@StandardTableau": (t) => rowsText(promotionOf(rows(t))),
  "InverseTableauPromotion@StandardTableau": (t) => rowsText(inversePromotionOf(rows(t))),
  "Promotion@DyckPath": (d) => list(throughTwoRows(ints(d), promotionOf)),
  "InversePromotion@DyckPath": (d) => list(throughTwoRows(ints(d), inversePromotionOf)),
  "PeaksToValleys@DyckPath": (d) => list(peaksToValleys(ints(d))),
  // RSK, evacuate the recording tableau, and RSK backwards.
  "CactusEvacuation@Permutation": (p) => {
    const [insertion, recording] = rskPair(ints(p));
    return list(inverseRskPair(insertion, evacuationOf(recording)));
  },
  "FoataMajorToInversions@Permutation": (p) => list(foataBijection(ints(p))),
  "FoataInversionsToMajor@Permutation": (p) => list(inverseFoataBijection(ints(p))),
  "GrayNext@BinaryWord": (w) => wordText(grayNext(letters(w))),
  "GrayPrevious@BinaryWord": (w) => wordText(grayPrevious(letters(w))),
  "ValleysToPeaks@BinaryWord": (w) => wordText(valleysToPeaks(letters(w))),
  "Rowmotion@BinaryWord": (w) => wordText(rowmotion(letters(w))),
  "PathRowmotion@BinaryWord": (w) => wordText(pathRowmotion(letters(w))),
  "ZerosToFlagZeros@BinaryWord": (w) => wordText(zerosToFlagZeros(letters(w))),
  "FlagZerosToZeros@BinaryWord": (w) => wordText(flagZerosToZeros(letters(w))),
  "FoataMajorToInversions@BinaryWord": (w) => wordText(foataBijection(letters(w))),
  "FoataInversionsToMajor@BinaryWord": (w) => wordText(inverseFoataWord(letters(w))),
  "FoataMajorToInversions@Composition": (c) => list(foataBijection(ints(c))),
  "FoataInversionsToMajor@Composition": (c) => list(inverseFoataWord(ints(c))),
  "CodeWord@Composition": (c) => wordText(ints(c).flatMap((part) => [1, ...range(2, part).map(() => 0)])),
  "CodeComposition@BinaryWord": (w) => {
    const parts: number[] = [];
    for (const letter of [1, ...letters(w)]) {
      if (letter === 1) parts.push(1);
      else parts[parts.length - 1]!++;
    }
    return list(parts);
  },
  "DeltaMorphism@Composition": (c) => {
    const runs: number[] = [];
    ints(c).forEach((part, k) => {
      if (k > 0 && part === ints(c)[k - 1]) runs[runs.length - 1]!++;
      else runs.push(1);
    });
    return list(runs);
  },
  "Peeling@DyckPath": (d) => list(peeling(ints(d))),
  "ClockwiseTriangulationRotation@DyckPath": (d) => list(rotateClockwise(ints(d))),
  "CounterclockwiseTriangulationRotation@DyckPath": (d) => list(rotateCounterclockwise(ints(d))),
  "Catabolism@StandardTableau": (t) => rowsText(catabolism(rows(t))),
  "RemoveFirstPart@IntegerPartition": (p) => list(ints(p).slice(1)),
  // Remove the first column (one cell from each part, the number of parts long) and write it as a row of its own.
  "BulgarianSolitaire@IntegerPartition": (p) =>
    list(descending([...ints(p).map((part) => part - 1), ints(p).length].filter((part) => part > 0))),
  "OddPartsWord@IntegerPartition": (p) => wordText(ints(p).map((part) => part % 2)),
  "BlockSizeComposition@SetComposition": (p) => list(orderedBlocks(p).map((block) => block.length)),
  "UnderlyingSetPartition@SetComposition": (p) => blocksText(orderedBlocks(p).toSorted((a, b) => a[0]! - b[0]!)),
  "BlockConcatenation@SetComposition": (p) => list(orderedBlocks(p).flat()),
  "CompositionBouncePath@Composition": (c) =>
    list(ints(c).flatMap((part) => [...range(1, part).map(() => 1), ...range(1, part).map(() => 0)])),
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
