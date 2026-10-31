// Our statistic distributions against FindStat's. For each statistic we have matched to a FindStat
// id (`findstat-data.ts`), FindStat's (object, value) pairs give a distribution per size; ours is
// `Tally(CombinatorialStat(Coll(n), "Head"))`, the call the distribution pane makes. A size is
// compared only when the pairs cover every object of it: as many distinct objects as our
// collection has. The distribution helper itself (`frontend/src/distribution.ts`) sits above this
// package, so the tally is read here directly.
//
// Pairs come from the committed snapshot (`data/statistics.json`: the smallest eight rows of each
// statistic, so few sizes are covered) or, under DEEP_TESTS=1 with FINDSTAT_CRAWL=<dir of
// <crawl>/StatisticsDatabase>, from the whole crawl, up to size DEEP_SIZE. A disagreement is
// never dropped: it is pinned in `distribution-crosscheck.golden.json` with its classification
// (the oracle's `DIVERGENCE_KINDS`; `unclassified` while it is a judgment call), so the run fails
// only when the set of disagreements changes. Regenerate with UPDATE_FINDSTAT_DISTRIBUTIONS=1.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../../src/index.ts";
import { COLLECTION_CARRIER, objectSize } from "../src/objects.ts";
import { findstat } from "../src/findstat-data.ts";

const DEEP = process.env.DEEP_TESTS === "1";
const CRAWL = process.env.FINDSTAT_CRAWL;
const MAX_SIZE = DEEP ? Number(process.env.DEEP_SIZE ?? 6) : 5;
const GOLDEN = new URL("./distribution-crosscheck.golden.json", import.meta.url);

/** Our collection of each carrier, and its size argument for FindStat's size `n`. */
const COLLECTIONS: Readonly<Record<string, [head: string, argument: (size: number) => number]>> = {
  Permutation: ["Permutations", (n) => n],
  IntegerPartition: ["IntegerPartitions", (n) => n],
  DyckPath: ["DyckPaths", (n) => n],
  SetPartition: ["SetPartitions", (n) => n],
  Composition: ["IntegerCompositions", (n) => n],
  BinaryTree: ["BinaryTrees", (n) => n],
  OrderedTree: ["OrderedTrees", (n) => n],
};

type Kind = "unclassified" | "emit" | "convention" | "ours";
interface Disagreement {
  readonly kind: Kind;
  readonly note: string;
  readonly ours: Record<string, number>;
  readonly theirs: Record<string, number>;
}
type Golden = Record<string, Disagreement>;

const ce = bareEngine();
declareStructures(ce);
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
const value = (json: unknown) => ce.box(json as never).evaluate().json;

interface Snapshot {
  readonly items: Readonly<Record<string, { collection: string; sample: readonly [string, number][] }>>;
}
const snapshot = JSON.parse(readFileSync(new URL("../data/statistics.json", import.meta.url), "utf8")) as Snapshot;

/** FindStat's pairs for `id`: the whole crawl when there is one in a deep run, else the snapshot. */
function pairsOf(id: string): readonly [string, number][] {
  if (DEEP && CRAWL && existsSync(`${CRAWL}/${id}.json`)) {
    const data = JSON.parse(readFileSync(`${CRAWL}/${id}.json`, "utf8")) as { StatisticData: Record<string, number> };
    return Object.entries(data.StatisticData);
  }
  return snapshot.items[id]?.sample ?? [];
}

/** value -> count over the objects of one size, ascending by value, as the object `{value: count}`. */
const tallyOf = (values: readonly number[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const v of values.toSorted((a, b) => a - b)) out[v] = (out[v] ?? 0) + 1;
  return out;
};

/** Ours: the call the distribution pane makes, read as `{value: count}`. */
function ourTally(carrier: string, size: number, head: string): Record<string, number> | undefined {
  const [collection, argument] = COLLECTIONS[carrier]!;
  const answer = value(["Tally", ["CombinatorialStat", [collection, argument(size)], `'${head}'`]]) as unknown;
  if (!Array.isArray(answer) || answer[0] !== "Tuple") return undefined;
  const values = (answer[1] as unknown[]).slice(1).map(Number);
  const counts = (answer[2] as unknown[]).slice(1).map(Number);
  if (values.some((v) => !Number.isFinite(v))) return undefined;
  return Object.fromEntries(values.map((v, i) => [v, counts[i]!]));
}

interface Report {
  readonly compared: string[];
  readonly skipped: string[];
  readonly disagreements: Golden;
}

function sweep(only?: readonly string[]): Report {
  const compared: string[] = [];
  const skipped: string[] = [];
  const disagreements: Golden = {};
  const counts = new Map<string, number>();
  for (const match of findstat) {
    if (!COLLECTIONS[match.on]) continue;
    if (only && !only.includes(`${match.head}@${match.on}`)) continue;
    for (const id of match.findstat) {
      const bySize = new Map<number, Map<string, number>>();
      const entry = snapshot.items[id];
      if (!entry || COLLECTION_CARRIER[entry.collection] !== match.on) continue;
      for (const [object, v] of pairsOf(id)) {
        const size = objectSize(match.on, object);
        if (size === undefined || size > MAX_SIZE || typeof v !== "number") continue;
        (bySize.get(size) ?? bySize.set(size, new Map()).get(size)!).set(object, v);
      }
      for (const [size, objects] of [...bySize].toSorted((a, b) => a[0] - b[0])) {
        const label = `${match.head}@${match.on} ${id} n=${size}`;
        const key = `${match.on}:${size}`;
        let ours: Record<string, number> | undefined;
        try {
          if (!counts.has(key)) {
            const [collection, argument] = COLLECTIONS[match.on]!;
            counts.set(key, Number(value(["Count", [collection, argument(size)]])));
          }
          if (objects.size !== counts.get(key)) {
            skipped.push(`${label}: ${objects.size} of ${counts.get(key)} objects`);
            continue;
          }
          ours = ourTally(match.on, size, match.head);
        } catch (error) {
          skipped.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
        if (ours === undefined) {
          skipped.push(`${label}: ours has no numeric tally`);
          continue;
        }
        const theirs = tallyOf([...objects.values()]);
        compared.push(label);
        if (JSON.stringify(ours) !== JSON.stringify(theirs))
          disagreements[label] = { kind: "unclassified", note: "", ours, theirs };
      }
    }
  }
  return { compared, skipped, disagreements };
}

const readGolden = (): Golden => (existsSync(GOLDEN) ? (JSON.parse(readFileSync(GOLDEN, "utf8")) as Golden) : {});

/** The pinned disagreements keep their classification; a new one arrives `unclassified`. */
function merge(golden: Golden, found: Golden): Golden {
  return Object.fromEntries(
    Object.entries(found).map(([label, d]) => [
      label,
      golden[label] ? { ...d, kind: golden[label].kind, note: golden[label].note } : d,
    ]),
  );
}

const REPRESENTATIVE = ["Valleys@Permutation", "Peaks@DyckPath", "Blocks@SetPartition", "Leaves@BinaryTree"];

/** The pinned disagreements among the compared sizes (and `heads`, when given): a run that sees them must reproduce them. */
const pinned = (golden: Golden, heads: readonly string[] | undefined, compared: readonly string[]): Golden =>
  Object.fromEntries(
    Object.entries(golden).filter(
      ([label]) => compared.includes(label) && (!heads || heads.some((h) => label.startsWith(`${h} `))),
    ),
  );

function expectPinned(report: Report, heads?: readonly string[]): void {
  const expected = pinned(readGolden(), heads, report.compared);
  expect(Object.keys(report.disagreements).toSorted()).toEqual(Object.keys(expected).toSorted());
  for (const [label, d] of Object.entries(report.disagreements))
    expect({ ours: d.ours, theirs: d.theirs }, label).toEqual({
      ours: expected[label]!.ours,
      theirs: expected[label]!.theirs,
    });
}

test("a handful of statistics agree with FindStat's distributions, or are pinned", () => {
  const report = sweep(REPRESENTATIVE);
  // Each is compared on a size past n = 1, where a distribution says something.
  for (const head of REPRESENTATIVE)
    expect(
      report.compared.some((label) => label.startsWith(`${head} `) && !/n=[01]$/.test(label)),
      head,
    ).toBe(true);
  expectPinned(report, REPRESENTATIVE);
});

test.skipIf(!DEEP)("every adopted statistic against FindStat's distributions, as far as the pairs cover", () => {
  // Without FINDSTAT_CRAWL this is the snapshot's sizes (n <= 3); with it, every size up to DEEP_SIZE (6).
  const report = sweep();
  expect(report.compared.length).toBeGreaterThan(0);
  console.info(
    `findstat distributions: ${report.compared.length} compared, ${Object.keys(report.disagreements).length} disagree, ${report.skipped.length} skipped`,
  );
  if (process.env.UPDATE_FINDSTAT_DISTRIBUTIONS === "1") {
    // Without the crawl only the snapshot's sizes are seen, so pins for the others stay.
    const golden = readGolden();
    const kept = Object.entries(golden).filter(([label]) => !report.compared.includes(label));
    const next = Object.fromEntries([...kept, ...Object.entries(merge(golden, report.disagreements))]);
    writeFileSync(GOLDEN, `${JSON.stringify(next, null, 2)}\n`);
    return;
  }
  expectPinned(report);
});
