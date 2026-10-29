import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps, MAPS } from "../../src/index.ts";
import { objectSize, readObject } from "../src/objects.ts";
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

/** Set compositions of 1..n: each set partition with its blocks in every order. */
const setCompositions = (n: number): number[][][] => {
  const orders = (rest: number[][]): number[][][] =>
    rest.length === 0
      ? [[]]
      : rest.flatMap((block, k) => orders(rest.filter((_, j) => j !== k)).map((tail) => [block, ...tail]));
  return setPartitions(n).flatMap(orders);
};

/** Binary trees with n nodes, as FindStat writes them. */
const binaryTrees = (n: number): string[] =>
  n === 0
    ? ["."]
    : range(0, n - 1).flatMap((k) =>
        binaryTrees(k).flatMap((left) => binaryTrees(n - 1 - k).map((right) => `[${left},${right}]`)),
      );

/** Ordered trees with n edges, as FindStat writes them: the root's first subtree has k edges, the rest n - 1 - k. */
const orderedTrees = (n: number): string[] =>
  n === 0
    ? ["[]"]
    : range(0, n - 1).flatMap((k) =>
        orderedTrees(k).flatMap((first) =>
          orderedTrees(n - 1 - k).map((rest) => `[${first}${rest === "[]" ? "" : `,${rest.slice(1, -1)}`}]`),
        ),
      );

/** Integer partitions of n, parts largest first. */
const integerPartitions = (n: number, most = n): number[][] =>
  n === 0
    ? [[]]
    : range(1, Math.min(n, most))
        .toReversed()
        .flatMap((part) => integerPartitions(n - part, part).map((rest) => [part, ...rest]));

/** Signed permutations of 1..n: every permutation with every choice of signs. */
const signedPermutations = (n: number): number[][] =>
  permutations(n).flatMap((word) =>
    range(0, 2 ** n - 1).map((mask) => word.map((value, k) => (mask & (1 << k) ? -value : value))),
  );

const through = <T>(max: number, from: number, make: (n: number) => T[]): T[] => range(from, max).flatMap(make);
const OBJECTS: Readonly<Record<string, string[]>> = {
  Permutation: through(4, 1, permutations).map((p) => JSON.stringify(p).replaceAll(" ", "")),
  BinaryWord: through(5, 0, (n) => range(0, 2 ** n - 1).map((k) => (n === 0 ? "" : k.toString(2).padStart(n, "0")))),
  Composition: through(5, 1, compositions).map((c) => JSON.stringify(c)),
  DyckPath: through(4, 1, dyckWords).map((w) => JSON.stringify(w)),
  SignedPermutation: through(4, 1, signedPermutations).map((p) => JSON.stringify(p).replaceAll(" ", "")),
  SetPartition: through(5, 1, setPartitions).map((p) => `{${p.map((block) => `{${block.join(",")}}`).join(",")}}`),
  StandardTableau: through(5, 1, tableaux).map((t) => JSON.stringify(t)),
  SetComposition: through(4, 1, setCompositions).map((p) => `[${p.map((block) => `{${block.join(",")}}`).join(",")}]`),
  BinaryTree: through(5, 1, binaryTrees),
  OrderedTree: through(5, 1, orderedTrees),
  IntegerPartition: through(6, 1, integerPartitions).map((p) => JSON.stringify(p)),
};

/** Our map for a reading's `Head@Carrier` key. */
const mapFor = (key: string) => {
  const [head, from] = key.split("@") as [string, string];
  const map = MAPS.find((m) => m.name === head && nameOf.get(m.from) === from);
  if (map === undefined) throw new Error(`${key}: no such map declared`);
  return { head, from, to: nameOf.get(map.to)! };
};

const normalize = (text: string): string => text.replace(/\s+/g, "");

/** Maps whose Epsil iterates (Demazure product, tableau actions) take their objects only this large in the standard run; DEEP_TESTS=1 lifts it. */
const SLOW: Readonly<Record<string, number>> = {
  "DemazureProductWithInverse@SignedPermutation": 3,
  "RowDescentsToColumnDescents@StandardTableau": 4,
};

for (const [key, reading] of Object.entries(MAP_READINGS)) {
  const { head, from, to } = mapFor(key);
  test(`${key}: the declared map agrees with its independent reading`, { timeout: 120_000 }, () => {
    const objects = OBJECTS[from];
    expect(objects, `objects of ${from}`).toBeDefined();
    const largest = process.env.DEEP_TESTS === "1" ? Number.POSITIVE_INFINITY : (SLOW[key] ?? Number.POSITIVE_INFINITY);
    for (const object of objects!.filter((o) => (objectSize(from, o) ?? 0) <= largest)) {
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
  "Mirror@BinaryTree": "Mp00016",
  "LeftRotation@BinaryTree": "Mp00009",
  "RightRotation@BinaryTree": "Mp00019",
  "LeftBorderSymmetry@BinaryTree": "Mp00018",
  "InverseZetaMap@DyckPath": "Mp00032",
  "BouncePath@DyckPath": "Mp00099",
  "DecompositionReverse@DyckPath": "Mp00101",
  "PrimeDyckPath@DyckPath": "Mp00199",
  "InverseFoata@Permutation": "Mp00086",
  "InverseKrewerasComplement@Permutation": "Mp00089",
  "LehmerCodeToMajorCode@Permutation": "Mp00062",
  "MajorCodeToLehmerCode@Permutation": "Mp00073",
  "LehmerCodeRotation@Permutation": "Mp00149",
  "ConnectivityWord@Permutation": "Mp00114",
  "LeftToRightMaximaDyckPath@Permutation": "Mp00127",
  "RunComposition@BinaryWord": "Mp00097",
  "Twist@BinaryWord": "Mp00200",
  "AlternatingComplement@BinaryWord": "Mp00158",
  "IncreasingRotation@SetPartition": "Mp00091",
  "DecreasingRotation@SetPartition": "Mp00176",
  "BlockSizeComposition@SetPartition": "Mp00128",
  "TableauDescentWord@StandardTableau": "Mp00134",
  "ReadingWord@StandardTableau": "Mp00081",
  "PeakComposition@StandardTableau": "Mp00294",
  "ValleyComposition@StandardTableau": "Mp00295",
  "OrderedTree@BinaryTree": "Mp00010",
  "RightBranchOrderedTree@BinaryTree": "Mp00015",
  "BinaryTree@OrderedTree": "Mp00049",
  "RightBranchBinaryTree@OrderedTree": "Mp00050",
  "Mirror@OrderedTree": "Mp00048",
  "Rotation@OrderedTree": "Mp00246",
  "DyckPath@OrderedTree": "Mp00051",
  "OrderedTree@DyckPath": "Mp00026",
  "DeBruijnMorselt@OrderedTree": "Mp00328",
  "FoataMajorToInversions@Permutation": "Mp00067",
  "FoataInversionsToMajor@Permutation": "Mp00175",
  "Reverse@SetComposition": "Mp00288",
  "Complement@SetComposition": "Mp00289",
  "CyclicShift@SetComposition": "Mp00292",
  "InverseCyclicShift@SetComposition": "Mp00291",
  "RunSort@Permutation": "Mp00223",
  "RunSort@BinaryWord": "Mp00224",
  "Evacuation@StandardTableau": "Mp00085",
  "TableauPromotion@StandardTableau": "Mp00155",
  "InverseTableauPromotion@StandardTableau": "Mp00153",
  "Promotion@DyckPath": "Mp00142",
  "InversePromotion@DyckPath": "Mp00143",
  "PeaksToValleys@DyckPath": "Mp00222",
  "CactusEvacuation@Permutation": "Mp00126",
  "GrayNext@BinaryWord": "Mp00272",
  "GrayPrevious@BinaryWord": "Mp00273",
  "ValleysToPeaks@BinaryWord": "Mp00234",
  "Rowmotion@BinaryWord": "Mp00278",
  "PathRowmotion@BinaryWord": "Mp00280",
  "ZerosToFlagZeros@BinaryWord": "Mp00268",
  "FlagZerosToZeros@BinaryWord": "Mp00269",
  "FoataMajorToInversions@BinaryWord": "Mp00096",
  "FoataInversionsToMajor@BinaryWord": "Mp00316",
  "FoataMajorToInversions@Composition": "Mp00314",
  "FoataInversionsToMajor@Composition": "Mp00315",
  "CodeWord@Composition": "Mp00094",
  "CodeComposition@BinaryWord": "Mp00178",
  "DeltaMorphism@Composition": "Mp00133",
  "CompositionBouncePath@Composition": "Mp00231",
  "Peeling@DyckPath": "Mp00103",
  "ClockwiseTriangulationRotation@DyckPath": "Mp00330",
  "CounterclockwiseTriangulationRotation@DyckPath": "Mp00331",
  "Catabolism@StandardTableau": "Mp00106",
  "RemoveFirstPart@IntegerPartition": "Mp00202",
  "BulgarianSolitaire@IntegerPartition": "Mp00308",
  "OddPartsWord@IntegerPartition": "Mp00317",
  "BlockSizeComposition@SetComposition": "Mp00287",
  "UnderlyingSetPartition@SetComposition": "Mp00285",
  "BlockConcatenation@SetComposition": "Mp00286",
  "BinaryWord@IntegerPartition": "Mp00095",
  "KasraouiZeng@SetPartition": "Mp00115",
  "CallanSwitch@SetPartition": "Mp00249",
  "InverseKrewerasComplement@DyckPath": "Mp00327",
  "KnuthKrattenthaler@DyckPath": "Mp00296",
  "SwapReturnsAndLastDescent@DyckPath": "Mp00118",
  "Reverse@SignedPermutation": "Mp00161",
  "Inverse@SignedPermutation": "Mp00162",
  "Complement@SignedPermutation": "Mp00188",
  "NegateSigns@SignedPermutation": "Mp00244",
  "SignWord@SignedPermutation": "Mp00267",
  "UnderlyingPermutation@SignedPermutation": "Mp00163",
  "SignedPermutation@Permutation": "Mp00170",
  "Standardization@SignedPermutation": "Mp00245",
  "NegativesToFlagNegatives@SignedPermutation": "Mp00270",
  "FlagNegativesToNegatives@SignedPermutation": "Mp00271",
  "PositiveCycleType@SignedPermutation": "Mp00166",
  "NegativeCycleType@SignedPermutation": "Mp00169",
  "KrewerasComplement@SignedPermutation": "Mp00168",
  "InverseKrewerasComplement@SignedPermutation": "Mp00167",
  "FoataHan@SignedPermutation": "Mp00190",
  "InverseFoataHan@SignedPermutation": "Mp00194",
  "DemazureProductWithInverse@SignedPermutation": "Mp00260",
  "Rowmotion@SignedPermutation": "Mp00281",
  "RowDescentsToColumnDescents@StandardTableau": "Mp00226",
  "CutOutPartition@DyckPath": "Mp00027",
  "TwoRowTableau@DyckPath": "Mp00033",
  "KrattenthalerPermutation@DyckPath": "Mp00119",
  "BilleyJockuschStanleyPermutation@DyckPath": "Mp00129",
  "Avoiding132Permutation@DyckPath": "Mp00025",
  "Avoiding312Permutation@DyckPath": "Mp00031",
  "Avoiding321Permutation@DyckPath": "Mp00024",
  "NoncrossingPartition@DyckPath": "Mp00138",
  "TamariBinaryTree@DyckPath": "Mp00029",
  "TamariDyckPath@BinaryTree": "Mp00020",
  "DelestViennot@DyckPath": "Mp00229",
  "InverseDelestViennot@DyckPath": "Mp00227",
  "ReflectParallelogramPolyomino@DyckPath": "Mp00228",
  "MinimalDyckPath@IntegerPartition": "Mp00043",
  "ParallelogramPolyominoDyckPath@IntegerPartition": "Mp00230",
  "InitialTableau@IntegerPartition": "Mp00042",
  "ReadingTableau@IntegerPartition": "Mp00045",
  "GlaisherFranklin@IntegerPartition": "Mp00312",
  "InverseGlaisherFranklin@IntegerPartition": "Mp00313",
  "IncreasingCyclePermutation@SetPartition": "Mp00080",
  "AssociatedStandardTableau@SetPartition": "Mp00258",
  "IntertwiningToDualMajorIndex@SetPartition": "Mp00171",
  "DualMajorIndexToIntertwining@SetPartition": "Mp00174",
  "WeakExceedancePartition@Permutation": "Mp00240",
  "RowSetPartition@StandardTableau": "Mp00284",
  "CoriLeBorgne@DyckPath": "Mp00121",
  "ElizaldeDeutsch@DyckPath": "Mp00122",
  "BarnabeiCastronuovo@DyckPath": "Mp00123",
  "WachsWhite@SetPartition": "Mp00215",
  "InverseWachsWhite@SetPartition": "Mp00216",
  "WachsWhiteRho@SetPartition": "Mp00217",
  "InverseWachsWhiteRho@SetPartition": "Mp00218",
  "InverseYip@SetPartition": "Mp00219",
  "Yip@SetPartition": "Mp00220",
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
