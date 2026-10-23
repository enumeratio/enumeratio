import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps, MAPS } from "../../src/index.ts";
import { readObject } from "../src/objects.ts";
import { MAP_READINGS } from "./map-findstat-readings.ts";

// Each FindStat map we declare is read twice independently (a JS reading of FindStat's description, and
// our Epsil definition) and the two are held to each other over every small object of the source carrier,
// and the reading to the rows of FindStat's snapshot. The full tables are checked against the crawl by
// ../scripts/check-findstat-maps.ts.

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((carrier) => [carrier.type, carrier.name])));

const nameOf = new Map(CARRIERS.map((carrier) => [carrier.type, carrier.name]));

// --- every object of each source carrier through a small size, as FindStat writes it ---

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, k) => from + k);
const permutations = (n: number): number[][] =>
  n === 0
    ? [[]]
    : permutations(n - 1).flatMap((rest) =>
        range(0, rest.length).map((i) => [...rest.slice(0, i), n, ...rest.slice(i)]),
      );
const compositions = (n: number): number[][] =>
  n === 0 ? [[]] : range(1, n).flatMap((first) => compositions(n - first).map((rest) => [first, ...rest]));
const dyckWords = (n: number): number[][] => {
  const out: number[][] = [];
  const walk = (word: number[], up: number, down: number): void => {
    if (word.length === 2 * n) out.push(word);
    else {
      if (up < n) walk([...word, 1], up + 1, down);
      if (down < up) walk([...word, 0], up, down + 1);
    }
  };
  walk([], 0, 0);
  return out;
};
/** Set partitions of 1..n, from their restricted growth strings. */
const setPartitions = (n: number): number[][][] => {
  const out: number[][][] = [];
  const grow = (labels: number[]): void => {
    if (labels.length === n) {
      const blocks: number[][] = [];
      labels.forEach((label, k) => (blocks[label] ??= []).push(k + 1));
      out.push(blocks);
    } else for (let label = 0; label <= Math.max(-1, ...labels) + 1; label++) grow([...labels, label]);
  };
  grow([]);
  return out;
};
/** Standard tableaux with n cells: place n in a corner of a smaller tableau's shape. */
const tableaux = (n: number): number[][][] => {
  if (n === 0) return [[]];
  return tableaux(n - 1).flatMap((t) => [
    ...t
      .map((row, r) => (r === 0 || t[r - 1]!.length > row.length ? t.map((x, k) => (k === r ? [...x, n] : x)) : []))
      .filter((x) => x.length > 0),
    [...t, [n]],
  ]);
};

const through = <T>(max: number, from: number, make: (n: number) => T[]): T[] => range(from, max).flatMap(make);
const OBJECTS: Readonly<Record<string, string[]>> = {
  Permutation: through(4, 1, permutations).map((p) => JSON.stringify(p).replaceAll(" ", "")),
  BinaryWord: through(5, 0, (n) => range(0, 2 ** n - 1).map((k) => (n === 0 ? "" : k.toString(2).padStart(n, "0")))),
  Composition: through(5, 1, compositions).map((c) => JSON.stringify(c)),
  DyckPath: through(4, 1, dyckWords).map((w) => JSON.stringify(w)),
  SetPartition: through(5, 1, setPartitions).map((p) => `{${p.map((block) => `{${block.join(",")}}`).join(",")}}`),
  StandardTableau: through(5, 1, tableaux).map((t) => JSON.stringify(t)),
};

/** Our map for a reading's `Head@Carrier` key. */
const mapFor = (key: string) => {
  const [head, from] = key.split("@") as [string, string];
  const map = MAPS.find((m) => m.name === head && nameOf.get(m.from) === from);
  if (map === undefined) throw new Error(`${key}: no such map declared`);
  return { head, from, to: nameOf.get(map.to)! };
};

const normalize = (text: string): string => text.replace(/\s+/g, "");

for (const [key, reading] of Object.entries(MAP_READINGS)) {
  const { head, from, to } = mapFor(key);
  test(`${key}: the declared map agrees with its independent reading`, () => {
    const objects = OBJECTS[from];
    expect(objects, `objects of ${from}`).toBeDefined();
    for (const object of objects!) {
      let image: string;
      try {
        image = reading(object);
      } catch {
        continue; // a reading undefined here (e.g. the descent word of the empty permutation).
      }
      const ours = ce.box([head, readObject(from, object)] as never).evaluate().json;
      expect(JSON.stringify(ours), `${head} ${object}`).toBe(JSON.stringify(readObject(to, image)));
    }
  });
}

// FindStat's snapshot holds a few rows of every map in its slice, and the readings reproduce them.
const snapshot = JSON.parse(readFileSync(new URL("../data/maps.json", import.meta.url), "utf8")) as {
  items: Record<string, { sample: [string, string][] }>;
};
const IDS: Readonly<Record<string, string>> = {
  "Reverse@BinaryWord": "Mp00104",
  "Complement@BinaryWord": "Mp00105",
  "CyclicShift@BinaryWord": "Mp00135",
  "InverseCyclicShift@BinaryWord": "Mp00136",
  "Reverse@Composition": "Mp00038",
  "Complement@Composition": "Mp00039",
  "TransposeComposition@Composition": "Mp00041",
  "CyclicShift@Composition": "Mp00173",
  "InverseCyclicShift@Composition": "Mp00172",
  "SortedPartition@Composition": "Mp00040",
  "ReverseComplement@DyckPath": "Mp00028",
  "BinaryWord@DyckPath": "Mp00093",
  "TouchComposition@DyckPath": "Mp00100",
  "RiseComposition@DyckPath": "Mp00102",
  "ZetaMap@DyckPath": "Mp00030",
  "LalanneKreweras@DyckPath": "Mp00120",
  "Complement@SetPartition": "Mp00112",
  "BlockSizePartition@SetPartition": "Mp00079",
  "TableauShape@StandardTableau": "Mp00083",
  "TransposeTableau@StandardTableau": "Mp00084",
  "DescentWord@Permutation": "Mp00109",
  "DescentTopWord@Permutation": "Mp00130",
  "DescentBottomWord@Permutation": "Mp00131",
  "LongCycleConjugation@Permutation": "Mp00265",
  "KrewerasComplement@Permutation": "Mp00088",
};

test("every reading names the FindStat map it is", () => {
  expect(Object.keys(IDS).toSorted()).toEqual(Object.keys(MAP_READINGS).toSorted());
});

for (const [key, id] of Object.entries(IDS)) {
  const reading = MAP_READINGS[key]!;
  test(`${key} reproduces ${id}'s snapshot rows`, () => {
    const sample = snapshot.items[id]?.sample;
    if (sample === undefined) return; // not in the committed slice; the crawl check covers it.
    for (const [object, image] of sample) expect(normalize(reading(object)), object).toBe(normalize(image));
  });
}
