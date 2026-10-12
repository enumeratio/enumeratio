// SkewStandardTableaux defined in Epsil: against the order the TS kernel listed (a frozen record, dumped
// from it before it was replaced), an independent predicate for membership, and exact counts. The fast
// path (plain numbers) is held to the same.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { collectMessages } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { COMPILED_FAMILIES } from "../../collections/src/families/compiled-families.generated.js";
import { epsilKernelOn, kernelOn } from "../../collections/src/families/epsil.ts";
import { declareCombinatorics } from "../../src/index.ts";
import { skewShapeCount, skewShapeUnrank } from "../../partitions/src/families/skew-shapes.ts";
import { entries, EXACT_COUNTS, TABLE_CELLS } from "../src/families/skew-standard-tableaux.ts";
import { standardTableaux } from "../src/families/standard-tableaux.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const [family] = entries;
const ce = bareEngine();
const epsil = epsilKernelOn(ce, family);
const fast = kernelOn(ce, family);

// A frozen record of the order the family had as a TS kernel: for n ≤ 6 every shape's row words, in order
// (λ/μ as comma lists, the word the 0-based row of each entry); for n = 7 the count, a digest of all its
// `λ/μ/word` lines and every 211th of them. It is not regenerated: the Epsil must list the tableaux in it.
const OLD = JSON.parse(readFileSync(new URL("./golden/old-skew-standard-tableaux.json", import.meta.url), "utf8")) as {
  shapes: Record<string, Record<string, string[]>>;
  seven: { count: number; sha256: string; every: number; samples: string[] };
};
const parse = (line: string): [number[], number[], number[]] => {
  const [lam, mu, word] = line
    .split("/")
    .map((part, i) => (i === 2 ? part.split("").map(Number) : part === "" ? [] : part.split(",").map(Number)));
  return [lam, mu, word];
};
const written = (element: unknown): string => {
  const [lam, mu, word] = element as number[][];
  return `${lam.join(",")}/${mu.join(",")}/${word.join("")}`;
};
const lines = (n: number): string[] =>
  Object.entries(OLD.shapes[n]).flatMap(([shape, words]) => words.map((word) => `${shape}/${word}`));

for (const kernel of [epsil, fast]) {
  const name = kernel === epsil ? "Epsil" : "the fast path";
  test(`${name} lists the tableaux in the order the TS kernel did, and rank and unrank invert (n ≤ 6)`, () => {
    expect(Object.keys(OLD.shapes).length).toBe(7);
    for (let n = 0; n <= 6; n++) {
      const golden = lines(n);
      expect([n, kernel.count([n])]).toEqual([n, BigInt(golden.length)]);
      // Epsil takes some ten seconds over every tableau of size 6: the standard run takes each 13th of them.
      const every = kernel === epsil && n === 6 && !DEEP ? 13 : 1;
      golden.forEach((line, r) => {
        if (r % every !== 0) return;
        const member = parse(line);
        expect([n, r, written(kernel.unrank([n], BigInt(r)))]).toEqual([n, r, line]);
        expect([n, r, kernel.rank(member, [n])]).toEqual([n, r, BigInt(r)]);
        expect([n, line, kernel.valid(member, [n])]).toEqual([n, line, true]);
      });
    }
  });

  test(`${name} lists every 211th tableau of size 7 as the TS kernel did`, () => {
    const { count, every, samples } = OLD.seven;
    expect(kernel.count([7])).toBe(BigInt(count));
    samples.forEach((line, i) => {
      const r = i * every;
      expect([r, written(kernel.unrank([7], BigInt(r)))]).toEqual([r, line]);
      expect([r, kernel.rank(parse(line), [7])]).toEqual([r, BigInt(r)]);
      expect([r, kernel.valid(parse(line), [7])]).toEqual([r, true]);
    });
  });
}

// 336,322 unranks: a few seconds for the fast path, about two minutes for Epsil.
for (const kernel of [fast, epsil]) {
  test.skipIf(!DEEP)(
    `${kernel === epsil ? "Epsil" : "the fast path"} lists all of size 7 as the TS kernel did (a digest of every line)`,
    () => {
      const { count, sha256 } = OLD.seven;
      const hash = createHash("sha256");
      for (let r = 0; r < count; r++) hash.update(`${r === 0 ? "" : "\n"}${written(kernel.unrank([7], BigInt(r)))}`);
      expect(hash.digest("hex")).toBe(sha256);
    },
  );
}

/** Whether [lam, mu, word] is a skew standard tableau of n cells, written independently of the family:
 *  the word fills each row left to right, and every cell must be larger than the one above it. */
function isSkewTableau(element: unknown, n: number): boolean {
  if (!Array.isArray(element) || element.length !== 3) return false;
  const [lam, mu, word] = element as number[][];
  // A reduced shape: μ has no zero part, every row has a cell, every column 1..λ₁ is covered.
  if (mu.length > lam.length || mu.some((m) => m < 1)) return false;
  for (let i = 0; i < lam.length; i++) {
    if (lam[i] < 1 || (i > 0 && lam[i] > lam[i - 1])) return false;
    if (i > 0 && (mu[i] ?? 0) > (mu[i - 1] ?? 0)) return false;
    if ((mu[i] ?? 0) >= lam[i]) return false;
  }
  if (lam.reduce((a, b) => a + b, 0) - mu.reduce((a, b) => a + b, 0) !== n) return false;
  for (let col = 1; col <= (lam[0] ?? 0); col++)
    if (!lam.some((end, i) => (mu[i] ?? 0) + 1 <= col && col <= end)) return false;
  if (word.length !== n) return false;
  const entry = lam.map((end) => Array.from({ length: end + 1 }, () => 0));
  const filled = lam.map(() => 0);
  for (let t = 0; t < n; t++) {
    const row = word[t];
    if (!Number.isInteger(row) || row < 0 || row >= lam.length) return false;
    const column = (mu[row] ?? 0) + filled[row] + 1;
    if (column > lam[row]) return false;
    entry[row][column] = t + 1;
    filled[row]++;
    // The cell above, if it is in the shape, must be placed already.
    if (row > 0 && column > (mu[row - 1] ?? 0) && column <= lam[row - 1] && entry[row - 1][column] === 0) return false;
  }
  return true;
}

/** Every partition with at most `maxParts` parts, each at most `maxVal`. */
function partitions(maxParts: number, maxVal: number): number[][] {
  const out: number[][] = [[]];
  const grow = (prefix: number[]): void => {
    if (prefix.length === maxParts) return;
    for (let v = 1; v <= (prefix.at(-1) ?? maxVal); v++) {
      out.push([...prefix, v]);
      grow([...prefix, v]);
    }
  };
  grow([]);
  return out;
}

/** Every word of `length` entries, each from -1 to `rows`. */
function words(length: number, rows: number): number[][] {
  if (length === 0) return [[]];
  return words(length - 1, rows).flatMap((rest) => Array.from({ length: rows + 2 }, (_, v) => [...rest, v - 1]));
}

test("the tableaux are every one found by filtering shapes and words, n ≤ 3 (4 with DEEP_TESTS)", () => {
  for (let n = 0; n <= (DEEP ? 4 : 3); n++) {
    const candidates = partitions(n + 1, n + 1);
    const expected = new Set<string>();
    for (const lam of candidates)
      for (const mu of candidates)
        for (const word of words(n, lam.length))
          if (isSkewTableau([lam, mu, word], n)) expected.add(JSON.stringify([lam, mu, word]));
    const total = Number(epsil.count([n]));
    const got = new Set<string>();
    for (let r = 0; r < total; r++) got.add(JSON.stringify(epsil.unrank([n], BigInt(r))));
    expect(got).toEqual(expected);
    expect(total).toBe(expected.size);
  }
});

test("membership over shapes near the size, with words near the right ones", () => {
  let rejected = 0;
  let nearMisses = 0;
  for (let n = 0; n <= (DEEP ? 3 : 2); n++) {
    const candidates = partitions(n + 1, n + 1);
    for (const lam of candidates)
      for (const mu of candidates)
        // μ as it is, and with a zero part added (names a member's shape but is none).
        for (const padded of [mu, [...mu, 0]])
          for (const word of words(n, lam.length)) {
            const want = isSkewTableau([lam, padded, word], n);
            for (const kernel of [epsil, fast])
              expect([n, lam, padded, word, kernel.valid([lam, padded, word], [n])]).toEqual([
                n,
                lam,
                padded,
                word,
                want,
              ]);
            if (!want) rejected++;
            if (!want && padded !== mu && isSkewTableau([lam, mu, word], n)) nearMisses++;
          }
  }
  expect(rejected).toBeGreaterThan(300);
  expect(nearMisses).toBeGreaterThan(5);
});

test("things that are no tableau at all are not members, each for its own reason", () => {
  // [n, element, why]: n is the element's cell count, so only the reason fails it.
  const bad: [number, unknown, string][] = [
    [2, [[2, 1], [1], [0]], "a word too short"],
    [2, [[2, 1], [1], [0, 1, 0]], "a word too long"],
    [2, [[2, 1], [1], [0, 0]], "a row with no cell left"],
    [2, [[2, 1], [1], [0, 2]], "a row that is none"],
    [2, [[2, 1], [1], [0, -1]], "a negative row"],
    [2, [[2, 1], [1], [0, 0.5]], "a row that is no integer"],
    [
      2,
      [
        [2, 1],
        [1, 0],
        [0, 1],
      ],
      "μ with a zero part",
    ],
    [1, [[2, 1], [1, 1], [0]], "a row with no cell"],
    [4, [[2, 2], [], [1, 0, 0, 1]], "a cell placed before the one above it"],
    [4, [[2, 2], [], [0, 1, 1, 0]], "a cell placed before the one above it, later"],
    [4, [[2, 2], [], [0, 0, 1, 1], 0], "four parts"],
    [4, [[2, 2], []], "two parts"],
    [3, [[2, 2], [], [0, 0, 1, 1]], "a size that is not the shape's"],
    [0, [[1], [], [0]], "a size that is not the shape's, the empty size"],
  ];
  for (const kernel of [epsil, fast]) {
    for (const [n, element, why] of bad) expect([why, kernel.valid(element as never, [n])]).toEqual([why, false]);
    // The same elements at their own size, mended, are members: each case fails for its reason alone.
    expect(kernel.valid([[2, 1], [1], [0, 1]], [2])).toBe(true);
    expect(kernel.valid([[2, 1], [1], [1, 0]], [2])).toBe(true);
    expect(kernel.valid([[2, 1], [], [0, 0, 1]], [3])).toBe(true);
    expect(kernel.valid([[2, 2], [], [0, 0, 1, 1]], [4])).toBe(true);
    expect(kernel.valid([[2, 2], [], [0, 1, 0, 1]], [4])).toBe(true);
    expect(kernel.valid([[], [], []], [0])).toBe(true);
    expect(kernel.valid([[], [], []], [1])).toBe(false);
  }
});

test("the counts are exact", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => fast.count([n]))).toEqual(
    [1, 1, 4, 24, 194, 1960, 23770, 336322, 5438496].map(BigInt),
  );
  // Epsil alone: a few seconds a size.
  expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => epsil.count([n]))).toEqual(
    [1, 1, 4, 24, 194, 1960, 23770, 336322].map(BigInt),
  );
  expect(epsil.count([-3])).toBe(0n);
  expect(fast.count([-3])).toBe(0n);
});

test("the exact counts are what the tables give, and a size past 2^53 declines at once, building no table", () => {
  expect(EXACT_COUNTS.slice(0, 9).map(BigInt)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => fast.count([n])));
  // Each size has at least n times the tableaux of the one before (a one-cell row on top, its entry anywhere in the word).
  EXACT_COUNTS.forEach((count, n) => expect(n === 0 || count >= n * EXACT_COUNTS[n - 1]).toBe(true));
  expect(EXACT_COUNTS.at(-1)! * EXACT_COUNTS.length).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  expect(EXACT_COUNTS.at(-1)!).toBeLessThan(Number.MAX_SAFE_INTEGER);
  const built: unknown[] = [];
  const quick = kernelOn(ce, family, COMPILED_FAMILIES, { fast: false, onTables: (p) => built.push(p) });
  const started = Date.now();
  for (const n of [15, 16, 40, 5000]) {
    expect(() => quick.count([n])).toThrow(RangeError);
    expect(() => quick.unrank([n], 0n)).toThrow(RangeError);
  }
  expect(built).toEqual([]);
  expect(Date.now() - started).toBeLessThan(1000);
});

test("the first, middle and last tableaux of a large fiber round-trip", () => {
  for (const n of [7]) {
    const total = epsil.count([n]) as bigint;
    for (const r of [0n, 1n, total / 3n, total / 2n, total - 2n, total - 1n]) {
      const element = epsil.unrank([n], r);
      expect(epsil.valid(element, [n])).toBe(true);
      expect(epsil.rank(element, [n])).toBe(r);
      expect(fast.unrank([n], r)).toEqual(element);
    }
    // The first tableau is the one row of n cells, and the last is the staircase's.
    expect(epsil.unrank([n], 0n)).toEqual([
      Array.from({ length: n }, () => 1),
      [],
      Array.from({ length: n }, (_, i) => i),
    ]);
  }
  // A rank outside the fiber is none.
  expect(() => epsil.unrank([4], 194n)).toThrow(RangeError);
  expect(() => epsil.unrank([4], -1n)).toThrow(RangeError);
});

test("through the engine: an element comes out, Element asks membership, and a call past the limit is refused", () => {
  const engine = bareEngine();
  declareCombinatorics(engine);
  const run = (expr: unknown) => {
    const { value, messages } = collectMessages(engine, () => engine.box(expr as never).evaluate());
    return { json: value.json, texts: messages.map((m) => (m as { text?: string }).text ?? "") };
  };
  expect(run(["Count", ["SkewStandardTableaux", 7]]).json).toBe(336322);
  const element = (x: unknown, n: number) => run(["Element", x, ["SkewStandardTableaux", n]]).json;
  const tableau = (lam: number[], mu: number[], word: number[]) => [
    "List",
    ["List", ...lam],
    ["List", ...mu],
    ["List", ...word],
  ];
  expect(element(tableau([2, 2], [], [0, 1, 0, 1]), 4)).toBe("True");
  expect(element(tableau([2, 2], [], [0, 1, 1, 0]), 4)).toBe("False");
  expect(element(tableau([2, 2], [], [0, 0, 1]), 4)).toBe("False");
  // μ with a zero part is not canonical.
  expect(element(tableau([2, 1], [1, 0], [0, 1]), 2)).toBe("False");
  expect(element(tableau([2, 1], [1], [0, 1]), 2)).toBe("True");
  // A row that is no integer is no member: the kernel's check of an element's well-formedness refuses it before any definition runs.
  expect(element(["List", ["List", 2, 1], ["List", 1], ["List", 0, 0.5]], 2)).toBe("False");
  expect(element(["List", ["List", 2, 1], ["List", 1], ["List", 0, 1]], 2)).toBe("True");
  expect(run(["At", ["SkewStandardTableaux", 3], 5]).json).toEqual(tableau([2, 1, 1], [1], [1, 0, 2]));
  // A walk answers up to what `work` allows, and the count is refused as a walk's steps.
  expect(Array.isArray(run(["At", ["SkewStandardTableaux", 7], 123456]).json)).toBe(true);
  expect(run(["Take", ["SkewStandardTableaux", 7], 2]).json).toHaveLength(3);
  const refused = run(["At", ["SkewStandardTableaux", 8], 1]);
  expect(refused.texts.join(" ")).toContain("SkewStandardTableaux(8) would take about 3,978,480 steps");
  expect(refused.json).toEqual(["At", ["SkewStandardTableaux", 8], 1]);
  expect(run(["Count", ["SkewStandardTableaux", 8]]).texts.join(" ")).toContain("would take about 3,978,480 steps");
  // Far past it the work is a bound, not a table.
  expect(run(["Count", ["SkewStandardTableaux", 200]]).texts.join(" ")).toContain("would take about");
});

test("the steps a call is bounded by are the cells of the shapes' tables", () => {
  for (let n = 0; n <= 9; n++) {
    let cells = 0;
    for (let s = 0; s < skewShapeCount(n); s++) {
      const [lam, mu] = skewShapeUnrank(n, s);
      cells += lam.length * lam.reduce((product, l, i) => product * (l - (mu[i] ?? 0) + 1), 1);
    }
    expect([n, TABLE_CELLS[n]]).toEqual([n, cells]);
  }
  expect(family.declared!.work!([7])).toBe(626024n);
  expect(family.declared!.work!([8])).toBe(3978480n);
  // The sizes grow by less than 7 each, past the list as in it.
  expect(TABLE_CELLS.every((cells, n) => n < 8 || cells < 7 * TABLE_CELLS[n - 1])).toBe(true);
  expect(family.declared!.work!([15])).toBe(2n * 105533129928n * 7n);
  expect(family.declared!.work!([-1])).toBe(0n);
});

test("past the table limit the fast path declines (undefined), and a rank outside the fiber still throws", () => {
  const raw = family.fast!;
  expect(raw.count([9])).toBeUndefined();
  expect(raw.unrank([9], 0)).toBeUndefined();
  expect(raw.rank([[9], [], Array.from({ length: 9 }, () => 0)], [9])).toBeUndefined();
  expect(() => raw.unrank([4], 194)).toThrow(RangeError);
  expect(() => raw.unrank([4], -1)).toThrow(RangeError);
});

// Listing every tableau of size 7 takes some seconds, so that size is a DEEP_TESTS one.
test("with μ empty the tableaux are the standard tableaux (the involutions: 232 at n = 7)", () => {
  const standard = kernelOn(ce, standardTableaux);
  for (let n = 0; n <= (DEEP ? 7 : 6); n++) {
    let straight = 0;
    const total = Number(fast.count([n]));
    for (let r = 0; r < total; r++) if ((fast.unrank([n], BigInt(r)) as number[][])[1].length === 0) straight++;
    expect([n, BigInt(straight)]).toEqual([n, standard.count([n])]);
  }
  expect(standard.count([7])).toBe(232n);
}, 60_000);
