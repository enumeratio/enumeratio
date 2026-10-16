// Check Dyck-path statistics against EVERY FindStat row in a local crawl of its
// StatisticsDatabase (read-only, outside the repo).
//
//   vp node packages/symbols/combinatorics/combinatorics/lattice-paths/scripts/check-findstat.ts <crawl>/StatisticsDatabase [Head=St000105 ...]
//
// `find-findstat.ts --crawl` already holds every match to all of its rows when it writes
// `findstat-data.ts`; this re-checks them (or a pair given here) on their own and names the
// disagreeing rows.
//
// With no pairs, checks every Dyck-path match in `findstat-data.ts`. Prints rows checked and any disagreement.

import { readFileSync } from "node:fs";
import { bareEngine } from "@enumeratio/engine/testing";
import { applyDefinition } from "../../src/statistics/declare.ts";
import { bySignature } from "../../src/statistics/types.ts";
import { findstat } from "../../findstat/src/findstat-data.ts";
import { DYCK_STATISTICS } from "../src/statistics.ts";

/** Our head -> FindStat ids, from the generated matches (`find-findstat.ts`), so there is one list. */
const MATCHES: Record<string, string[]> = Object.fromEntries(
  findstat.filter((m) => m.on === "DyckPath").map((m) => [m.head, [...m.findstat]]),
);

const [dir, ...pairs] = process.argv.slice(2);
if (!dir) throw new Error("usage: check-findstat.ts <StatisticsDatabase dir> [Head=StId ...]");
const targets: Record<string, string[]> = pairs.length
  ? Object.fromEntries(pairs.map((p) => p.split("=") as [string, string]).map(([head, id]) => [head, [id]]))
  : MATCHES;

const ce = bareEngine();
const index = bySignature(DYCK_STATISTICS);

for (const [head, ids] of Object.entries(targets)) {
  const definition = index.get(`${head}@DyckPath`);
  if (!definition) continue; // a match for a head declared elsewhere (e.g. a map or a tree statistic)
  for (const id of ids) {
    const data = (JSON.parse(readFileSync(`${dir}/${id}.json`, "utf8")) as { StatisticData: Record<string, number> })
      .StatisticData;
    let rows = 0;
    const bad: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      const ours = applyDefinition(ce, definition, ce.box(["List", ...(JSON.parse(key) as number[])] as never)).re;
      rows++;
      if (ours !== value) bad.push(`${key}: ours ${ours}, FindStat ${value}`);
    }
    const verdict = bad.length ? `DISAGREE ${bad.length}\n  ${bad.slice(0, 3).join("\n  ")}` : "ok";
    console.log(`${head} ${id} ${rows} rows: ${verdict}`);
  }
}
