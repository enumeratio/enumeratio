// FindStat's own data (https://www.findstat.org, each statistic's and map's published JSON),
// as a committed snapshot.
//
//   node packages/reference/scripts/collect-findstat-data.ts [--crawl DIR]
//
// Reads a crawl of those JSON files (the crawl itself is too big to commit; the site asks
// crawlers for a 20 s delay, and we ask its maintainers before crawling again) and writes
// `findstat/data/{statistics,maps}.json` in the combinatorics package: for every id its
// collection, title, description, properties and a few of the smallest (object, value) rows.
//
// Each area's generated statistic records (`areaStatisticsEntries`) read the snapshot for the
// FindStat rows they hold as `known` examples.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { crawl: { type: "string", default: join(homedir(), "Playground/@enumeratio/findstat-crawl") } },
});

const DATA = new URL("../../symbols/combinatorics/combinatorics/findstat/data/", import.meta.url).pathname;

/** Attribution that travels with the data. */
const SOURCE = {
  source: "https://www.findstat.org",
  note: "FindStat, the combinatorial statistic finder; each entry is its own page there.",
};

const readJson = (file: string): any => JSON.parse(readFileSync(file, "utf8"));

/** The smallest objects first (by text length, then order), so a sample is short and stable. */
function smallest(data: Record<string, unknown>, n: number): [string, unknown][] {
  return Object.entries(data)
    .toSorted((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, n);
}

/** The first paragraph, trimmed: a description's gist, with the page for the rest. */
const gist = (text: string, max = 400): string => {
  const first = text
    .replace(/\r/g, "")
    .split(/\n\s*\n/)[0]!
    .trim();
  return first.length > max ? `${first.slice(0, max - 1).trimEnd()}…` : first;
};

mkdirSync(DATA, { recursive: true });
const kinds = [
  ["StatisticsDatabase", "statistics", "Statistic"],
  ["MapsDatabase", "maps", "Map"],
] as const;
for (const [dir, out, prefix] of kinds) {
  const folder = join(values.crawl!, dir);
  const items: Record<string, unknown> = {};
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".json"))
    .toSorted()) {
    const raw = readJson(join(folder, file));
    const id = file.replace(/\.json$/, "");
    const description = gist(String(raw[`${prefix}Description`] ?? ""));
    items[id] =
      prefix === "Statistic"
        ? {
            collection: raw.StatisticCollection,
            title: raw.StatisticTitle,
            description,
            sample: smallest(raw.StatisticData ?? {}, 8),
          }
        : {
            domain: raw.MapDomain,
            codomain: raw.MapCodomain,
            title: raw.MapTitle,
            properties: String(raw.MapProperties ?? "")
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean),
            description,
            sample: smallest(raw.MapData ?? {}, 4),
          };
  }
  writeFileSync(join(DATA, `${out}.json`), `${JSON.stringify({ ...SOURCE, items })}\n`);
  console.log(`${out}: ${Object.keys(items).length}`);
}
