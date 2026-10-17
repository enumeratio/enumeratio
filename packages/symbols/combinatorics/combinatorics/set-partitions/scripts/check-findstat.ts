// Check set-partition statistics against EVERY FindStat row in a local crawl of its
// StatisticsDatabase (read-only, outside the repo).
//
//   vp node packages/symbols/combinatorics/combinatorics/set-partitions/scripts/check-findstat.ts <crawl>/StatisticsDatabase [Head=St000105 ...]
//
// Not adopted: St000728, St000729, St000730 (dimension, minimal and maximal arc length) agree
// on every row but seven size-8 ones, where FindStat's stored values contradict its own Sage
// code (negative arc lengths). Nor St000577 (pairs a < b in different blocks with a the greatest
// of its block), which agrees on every row but thirty size-8 ones, where FindStat's stored values
// contradict its own code.
//
// `find-findstat.ts --crawl` already holds every match to all of its rows when it writes
// `findstat-data.ts`; this re-checks them (or a pair given here) on their own and names the
// disagreeing rows.
//
// With no pairs, checks every set-partition match in `findstat-data.ts`. Prints rows checked and any disagreement.

import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { bySignature } from "../../src/statistics/types.ts";
import { findstat } from "../../findstat/src/findstat-data.ts";
import { SET_PARTITION_STATISTICS } from "../src/statistics.ts";

/** Our head -> FindStat id, from the generated matches (`find-findstat.ts`), so there is one list. */
export const MATCHES: Record<string, string> = Object.fromEntries(
  findstat.filter((m) => m.on === "SetPartition").map((m) => [m.head, m.findstat[0]!]),
);

const [dir, ...pairs] = process.argv.slice(2);
if (!dir) throw new Error("usage: check-findstat.ts <StatisticsDatabase dir> [Head=StId ...]");
const targets: Record<string, string> = pairs.length
  ? Object.fromEntries(pairs.map((p) => p.split("=") as [string, string]))
  : MATCHES;

const ce = bareEngine();
const index = bySignature(SET_PARTITION_STATISTICS);
// FindStat writes {{1,3},{2}}.
const parse = (key: string): number[][] =>
  JSON.parse(`[${key.slice(1, -1).replaceAll("{", "[").replaceAll("}", "]")}]`);

for (const [head, id] of Object.entries(targets)) {
  const definition = index.get(`${head}@SetPartition`);
  if (!definition) throw new Error(`no definition ${head}`);
  const data = (JSON.parse(readFileSync(`${dir}/${id}.json`, "utf8")) as { StatisticData: Record<string, number> })
    .StatisticData;
  let rows = 0;
  const bad: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const blocks = parse(key);
    const ours = applyDefinition(ce, definition, ce.box(["List", ...blocks.map((b) => ["List", ...b])] as never)).re;
    rows++;
    if (ours !== value) bad.push(`${key}: ours ${ours}, FindStat ${value}`);
  }
  const verdict = bad.length ? `DISAGREE ${bad.length}\n  ${bad.slice(0, 3).join("\n  ")}` : "ok";
  console.log(`${head} ${id} ${rows} rows: ${verdict}`);
}
