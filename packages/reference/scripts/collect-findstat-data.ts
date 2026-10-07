// FindStat's own data (https://www.findstat.org, each statistic's and map's published JSON),
// as a committed snapshot and as examples held to its values.
//
//   node packages/reference/scripts/collect-findstat-data.ts snapshot [--crawl DIR]
//   node packages/reference/scripts/collect-findstat-data.ts examples [--dry] [--per N]
//
// `snapshot` reads a crawl of those JSON files (the crawl itself is too big to commit; the
// site asks crawlers for a 20 s delay, and we ask its maintainers before crawling again) and
// writes `findstat/data/{statistics,maps}.json` in the combinatorics package: for every id its
// collection, title, description, properties and a few of the smallest (object, value) rows.
//
// `examples` adds, to each head of ours that `findstat-data.ts` matches to a statistic, a few
// of FindStat's rows as `CombinatorialStat(x, "Name")` examples with `known` and `source: FindStat St…`
// (the form that dispatches by the value's carrier, where a bare head such as `Peaks` is typed
// for one carrier): `tests/entries.test.ts`
// evaluates each and `tests/known.test.ts` holds the value to FindStat's. A row where we
// disagree fails there and is looked at, never rewritten to agree.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { MathJSON, ReferenceExample } from "@enumeratio/entry";
import { readHead, writeHead } from "@enumeratio/entry/node";
import { findstat } from "../../symbols/combinatorics/combinatorics/findstat/src/findstat-data.ts";

const { values, positionals } = parseArgs({
  options: {
    crawl: { type: "string", default: join(homedir(), "Playground/@enumeratio/findstat-crawl") },
    dry: { type: "boolean", default: false },
    per: { type: "string", default: "3" },
  },
  allowPositionals: true,
});

const PACKAGE = new URL("../../symbols/combinatorics/combinatorics/", import.meta.url).pathname;
const DATA = join(PACKAGE, "findstat/data");
const PACKAGES_ROOT = new URL("../../", import.meta.url).pathname;

/** Every folder of records: a package's `reference/`, and compute-engine's own in reference's `entries/`. */
function recordFolders(): string[] {
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === "node_modules" || entry.name === "dist") continue;
      const path = join(dir, entry.name);
      if (entry.name === "reference" || (entry.name === "entries" && dir.endsWith("/reference"))) found.push(path);
      else if (depth > 0) walk(path, depth - 1);
    }
  };
  walk(PACKAGES_ROOT, 3);
  return found;
}
const FOLDERS = recordFolders();
/** The folder that holds `head`'s record. */
const folderOf = (head: string): string | undefined => FOLDERS.find((dir) => existsSync(join(dir, head, "index.md")));

/** Attribution that travels with the data. */
const SOURCE = {
  source: "https://www.findstat.org",
  note: "FindStat, the combinatorial statistic finder; each entry is its own page there.",
};

type Rows = [string, number][];
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

function snapshot(): void {
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
}

// The text FindStat writes an object in, as the carrier value we read it as.
const list = (text: string): MathJSON => ["List", ...(JSON.parse(text) as number[])];
const READERS: Record<string, (text: string) => MathJSON> = {
  Permutation: (text) => ["Permutation", list(text)],
  IntegerPartition: (text) => ["IntegerPartition", list(text)],
  DyckPath: (text) => ["DyckPath", list(text)],
  SetPartition: (text) => [
    "SetPartition",
    ["List", ...(JSON.parse(text.replace(/\{/g, "[").replace(/\}/g, "]")) as number[][]).map((b) => ["List", ...b])],
  ],
};

async function examples(): Promise<void> {
  const stats = readJson(join(DATA, "statistics.json")).items as Record<string, { sample: Rows }>;
  const per = Number(values.per);
  const plan: { head: string; id: string; on: string; fsId: string; object: string; value: number; expr: MathJSON }[] =
    [];
  for (const match of findstat) {
    const read = READERS[match.on];
    const fsId = match.findstat[0];
    if (!read || !fsId || !(fsId in stats)) continue;
    // The nonempty objects: an empty one is a convention more than a check.
    const rows = stats[fsId]!.sample.filter(([o]) => !/^(\[\]|\{\})$/.test(o)).slice(0, per);
    rows.forEach(([object, value], n) =>
      plan.push({
        head: match.head,
        id: `findstat-${fsId.toLowerCase()}-${n + 1}`,
        on: match.on,
        fsId,
        object,
        value,
        expr: ["CombinatorialStat", read(object), `'${match.head}'`],
      }),
    );
  }
  // `expected` is FindStat's value too: `tests/entries.test.ts` evaluates each row, so a
  // statistic of ours that disagrees fails there, and that row is for a person to look at.
  const byHead = new Map<string, ReferenceExample[]>();
  for (const p of plan)
    (byHead.get(p.head) ?? byHead.set(p.head, []).get(p.head)!).push({
      id: p.id,
      expr: p.expr,
      expected: p.value,
      known: p.value,
      source: `FindStat ${p.fsId}`,
      caption: `FindStat's value for ${p.object}`,
      category: "Properties",
    });
  for (const [head, rows] of byHead) {
    const folder = folderOf(head);
    if (folder === undefined) {
      console.log(`${head}: no record found`);
      continue;
    }
    const record = readHead(folder, head);
    const have = new Set(record.entry.examples.map((e) => e.id));
    const add = rows.filter((r) => !have.has(r.id));
    if (add.length === 0) continue;
    console.log(`${head}: +${add.length}`);
    if (!values.dry)
      await writeHead(folder, head, {
        ...record,
        entry: { ...record.entry, examples: [...record.entry.examples, ...add] },
      });
  }
  console.log(`${plan.length} rows planned${values.dry ? " (dry run)" : ""}`);
}

if (positionals[0] === "snapshot") snapshot();
else if (positionals[0] === "examples") await examples();
else console.log("usage: collect-findstat-data.ts snapshot|examples [--dry] [--per N] [--crawl DIR]");
