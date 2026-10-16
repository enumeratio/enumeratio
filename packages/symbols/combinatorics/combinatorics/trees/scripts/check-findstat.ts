// Check binary-tree and ordered-tree statistics against EVERY FindStat row in a local crawl of
// its StatisticsDatabase (read-only, outside the repo).
//
//   vp node packages/symbols/combinatorics/combinatorics/trees/scripts/check-findstat.ts <crawl>/StatisticsDatabase [Head@Carrier=St000105 ...]
//
// `find-findstat.ts --crawl` already holds every match to all of its rows when it writes
// `findstat-data.ts`; this re-checks them (or a pair given here) on their own and names the
// disagreeing rows.
//
// With no pairs, checks every binary-tree and ordered-tree match in `findstat-data.ts`. Prints rows checked and any disagreement.

import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { bySignature } from "../../src/statistics/types.ts";
import { findstat } from "../../findstat/src/findstat-data.ts";
import { TREE_STATISTICS } from "../src/statistics.ts";

const CARRIERS = ["BinaryTree", "OrderedTree"];

/** `Head@Carrier` -> FindStat ids, from the generated matches (`find-findstat.ts`), so there is one list. */
const MATCHES: Record<string, string[]> = Object.fromEntries(
  findstat.filter((m) => CARRIERS.includes(m.on)).map((m) => [`${m.head}@${m.on}`, [...m.findstat]]),
);

const [dir, ...pairs] = process.argv.slice(2);
if (!dir) throw new Error("usage: check-findstat.ts <StatisticsDatabase dir> [Head@Carrier=StId ...]");
const targets: Record<string, string[]> = pairs.length
  ? Object.fromEntries(pairs.map((p) => p.split("=") as [string, string]).map(([signature, id]) => [signature, [id]]))
  : MATCHES;

/** FindStat writes a binary tree as [.,[.,.]] (. is empty) and an ordered tree as [[],[[]]]. */
const json = (carrier: string, key: string): unknown => {
  const nested = JSON.parse(carrier === "BinaryTree" ? key.replaceAll(".", "0") : key) as unknown;
  const walk = (tree: unknown): unknown => (Array.isArray(tree) ? ["List", ...tree.map(walk)] : tree);
  return walk(nested);
};

const ce = bareEngine();
const index = bySignature(TREE_STATISTICS);

for (const [signature, ids] of Object.entries(targets)) {
  const definition = index.get(signature);
  if (!definition) continue; // a match for a head declared elsewhere (e.g. Height on Dyck paths)
  for (const id of ids) {
    const data = (JSON.parse(readFileSync(`${dir}/${id}.json`, "utf8")) as { StatisticData: Record<string, number> })
      .StatisticData;
    let rows = 0;
    const bad: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      const ours = applyDefinition(ce, definition, ce.box(json(definition.on, key) as never)).re;
      rows++;
      if (ours !== value) bad.push(`${key}: ours ${ours}, FindStat ${value}`);
    }
    const verdict = bad.length ? `DISAGREE ${bad.length}\n  ${bad.slice(0, 3).join("\n  ")}` : "ok";
    console.log(`${signature} ${id} ${rows} rows: ${verdict}`);
  }
}
