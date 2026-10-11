// Ask FindStat which of its statistics each of ours IS, by value, and rewrite
// `@enumeratio/combinatorics`' `findstat/src/findstat-data.ts`.
//
// FindStat's finder takes a table of objects and values and answers with the statistics in
// its database that agree. That is the honest way to cross-reference a statistic -- by what
// it computes, not by what it is called (the catalog's own sweep caught "peaks" that were
// FindStat's *inner* peaks that way). So: enumerate every object of a carrier up to a size,
// evaluate our definition on each, post the table, and keep the pure statistics (no map
// composed in front) that agree on every value FindStat can check, with no offset.
//
// Two or more matches means the statistics agree on everything this small; the crosswalk
// shows them all and says so, and a bigger size range is the way to separate them. The
// ranges are what an expression definition evaluates in reasonable time -- about a minute
// per statistic over 873 permutations, so 153 it is.
//
// `values` is the number of (object, value) pairs a match rests on. Online, that is the sweep
// above. Offline, `--crawl` does the finder's job against a local crawl of FindStat's
// StatisticsDatabase (read-only, outside the repo): the sweep picks the candidates the way the
// finder does, then each candidate is held to EVERY row the crawl has for it, and `values` is
// the rows all the matched statistics share. Both paths write the same format.
//
//   vp node packages/reference/scripts/find-findstat.ts [--only Descents@Permutation]
//   vp node packages/reference/scripts/find-findstat.ts --crawl <crawl>/StatisticsDatabase --carrier SetPartition --carrier DyckPath
//
// `--carrier` (repeatable) regenerates just that carrier's rows and keeps the rest of the file,
// for when the other carriers are too slow to sweep again. Rows are written in `ALL_STATISTICS`
// order either way.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { ALL_STATISTICS, applyDefinition, type FindStatMatch, findstat as existing } from "@enumeratio/combinatorics";

const API = "https://www.findstat.org/api/StatisticsDatabase/";
const flag = (name: string): string[] => process.argv.flatMap((arg, i) => (arg === name ? [process.argv[i + 1]!] : []));
const only = flag("--only")[0];
const crawlDir = flag("--crawl")[0];
const onlyCarriers = new Set(flag("--carrier"));

// ── enumeration, per carrier, in FindStat's own spelling ─────────────────────────────────

/** Every permutation of 1..n. */
function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1)) {
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  }
  return out;
}
/** Every partition of n, parts weakly decreasing. */
function partitions(n: number, cap = n): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let part = Math.min(n, cap); part >= 1; part--) {
    for (const rest of partitions(n - part, part)) out.push([part, ...rest]);
  }
  return out;
}
/** Every Dyck word of semilength n, as 1 (up) and 0 (down). */
function dyckWords(n: number): number[][] {
  const out: number[][] = [];
  const walk = (word: number[], open: number, height: number): void => {
    if (word.length === 2 * n) {
      out.push(word);
      return;
    }
    if (open < n) walk([...word, 1], open + 1, height + 1);
    if (height > 0) walk([...word, 0], open, height - 1);
  };
  walk([], 0, 0);
  return out;
}
/** Every set partition of {1..n}, blocks in order of least element. */
function setPartitions(n: number): number[][][] {
  if (n === 0) return [[]];
  const out: number[][][] = [];
  for (const smaller of setPartitions(n - 1)) {
    for (let b = 0; b < smaller.length; b++) {
      out.push(smaller.map((block, i) => (i === b ? [...block, n] : block)));
    }
    out.push([...smaller, [n]]);
  }
  return out;
}

interface Carrier {
  /** FindStat's collection id. */
  readonly domain: string;
  /** The collection's name in the crawl's `StatisticCollection`. */
  readonly collection: string;
  /** The object, from the way FindStat spells it. */
  readonly parse: (spelling: string) => unknown;
  /** Sizes to enumerate; the triple-loop statistics get the smaller range. */
  readonly sizes: readonly number[];
  readonly small: readonly number[];
  readonly objects: (n: number) => readonly unknown[];
  /** The object as FindStat writes it. */
  readonly spell: (object: unknown) => string;
  /** The object as our definition takes it. */
  readonly box: (ce: ComputeEngine, object: unknown) => ReturnType<ComputeEngine["box"]>;
}

const list = (ce: ComputeEngine, xs: readonly number[]) => ce.box(["List", ...xs]);
const CARRIERS: Readonly<Record<string, Carrier>> = {
  Permutation: {
    domain: "Cc0001",
    collection: "Permutations",
    parse: (s) => JSON.parse(s),
    sizes: [1, 2, 3, 4, 5],
    small: [1, 2, 3, 4],
    objects: permutations,
    spell: (p) => `[${(p as number[]).join(",")}]`,
    box: (ce, p) => list(ce, p as number[]),
  },
  IntegerPartition: {
    domain: "Cc0002",
    collection: "Integer partitions",
    parse: (s) => JSON.parse(s),
    sizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    small: [1, 2, 3, 4, 5, 6, 7],
    objects: (n) => partitions(n),
    spell: (p) => `[${(p as number[]).join(",")}]`,
    box: (ce, p) => list(ce, p as number[]),
  },
  DyckPath: {
    domain: "Cc0005",
    collection: "Dyck paths",
    parse: (s) => JSON.parse(s),
    sizes: [1, 2, 3, 4, 5],
    small: [1, 2, 3, 4],
    objects: dyckWords,
    spell: (w) => `[${(w as number[]).join(",")}]`,
    box: (ce, w) => list(ce, w as number[]),
  },
  SetPartition: {
    domain: "Cc0009",
    collection: "Set partitions",
    // FindStat writes {{1,3},{2}}.
    parse: (s) => JSON.parse(`[${s.slice(1, -1).replaceAll("{", "[").replaceAll("}", "]")}]`),
    sizes: [1, 2, 3, 4, 5],
    small: [1, 2, 3, 4],
    objects: setPartitions,
    spell: (blocks) => `{${(blocks as number[][]).map((b) => `{${b.join(",")}}`).join(",")}}`,
    box: (ce, blocks) => ce.box(["List", ...(blocks as number[][]).map((b) => ["List", ...b])] as never),
  },
};

/** Definitions that cost n³ evaluations each; exhaustive still, over the smaller range. */
const CUBIC = new Set([
  "LongestIncreasingSubsequence",
  "LongestDecreasingSubsequence",
  "OccurrencesOf123",
  "OccurrencesOf132",
  "NumberOfOccurrencesOf213",
  "StackSortable",
]);

// ── the query ─────────────────────────────────────────────────────────────────────────────

interface Finder {
  readonly included?: {
    readonly MatchingStatistics: Record<
      string,
      { readonly MatchingStatistic: string; readonly Offset: number; readonly Quality: number[] }
    >;
  };
  readonly error?: string;
}

async function find(domain: string, data: string): Promise<string[]> {
  const body = new URLSearchParams({
    Domain: domain,
    Data: data,
    fields: "MatchingStatistic,Offset,Quality",
  });
  const response = await fetch(API, { method: "POST", body });
  const result = (await response.json()) as Finder;
  if (result.error) throw new Error(result.error);
  if (process.argv.includes("--debug")) {
    const pure = Object.values(result.included?.MatchingStatistics ?? {}).filter((m) =>
      /^St\d{6}$/.test(m.MatchingStatistic),
    );
    process.stdout.write(`  pure candidates: ${JSON.stringify(pure)}\n`);
  }
  return Object.values(result.included?.MatchingStatistics ?? {})
    .filter(
      (m) =>
        /^St\d{6}$/.test(m.MatchingStatistic) &&
        m.Offset === 0 &&
        // Quality is (share of our values FindStat could check, share of those that agree).
        // Every checked value has to agree; a few unchecked ones are FindStat not holding
        // the smallest objects (it has no size-1 set partition), not a disagreement.
        m.Quality[0]! >= 90 &&
        m.Quality[1] === 100,
    )
    .map((m) => m.MatchingStatistic)
    .toSorted();
}

// ── the same question, asked of a local crawl ──────────────────────────────────────────

type Rows = ReadonlyMap<string, number>;
const crawled = new Map<string, Map<string, Rows>>();
/** Every crawled statistic of one collection: id -> object spelling -> value. */
function crawlOf(collection: string): ReadonlyMap<string, Rows> {
  let found = crawled.get(collection);
  if (found) return found;
  found = new Map();
  for (const file of readdirSync(crawlDir!).toSorted()) {
    const stat = JSON.parse(readFileSync(`${crawlDir}/${file}`, "utf8")) as {
      StatisticCollection: string;
      StatisticData: Record<string, number>;
    };
    if (stat.StatisticCollection === collection)
      found.set(file.replace(".json", ""), new Map(Object.entries(stat.StatisticData)));
  }
  crawled.set(collection, found);
  return found;
}

/** What `find` answers, from the crawl: candidates by the sweep, then held to all their rows. */
function findInCrawl(
  carrier: Carrier,
  definition: (typeof ALL_STATISTICS)[number],
  rows: readonly string[],
  ce: ComputeEngine,
): { ids: string[]; values: number } {
  const sweep = rows.map((row) => row.split(" => ") as [string, string]);
  const ours = new Map<string, number>(sweep.map(([object, value]) => [object, Number(value)]));
  const ourValue = (spelling: string): number => {
    let value = ours.get(spelling);
    if (value === undefined) {
      value = applyDefinition(ce, definition, carrier.box(ce, carrier.parse(spelling))).re as number;
      ours.set(spelling, value);
    }
    return value;
  };
  const ids: string[] = [];
  let shared: Set<string> | undefined;
  for (const [id, data] of crawlOf(carrier.collection)) {
    // The finder's own bar: nearly all the sweep is checkable, and every checkable value agrees.
    const checkable = sweep.filter(([object]) => data.has(object));
    if (
      checkable.length < sweep.length * 0.9 ||
      checkable.some(([object, value]) => data.get(object) !== Number(value))
    )
      continue;
    // Then every row the crawl holds for it.
    if ([...data].some(([object, value]) => ourValue(object) !== value)) continue;
    ids.push(id);
    shared = new Set(shared ? [...shared].filter((object) => data.has(object)) : data.keys());
  }
  return { ids, values: shared?.size ?? 0 };
}

const ce = new ComputeEngine();
const matches: FindStatMatch[] = [];
for (const definition of ALL_STATISTICS) {
  const signature = `${definition.head}@${definition.on}`;
  if (only && signature !== only) continue;
  const carrier = CARRIERS[definition.on];
  if (!carrier) continue;
  if (onlyCarriers.size && !onlyCarriers.has(definition.on)) {
    // Not regenerated: the file's row carries over.
    const kept = existing.find((m) => m.head === definition.head && m.on === definition.on);
    if (kept) matches.push(kept);
    continue;
  }
  const sizes = CUBIC.has(definition.head) ? carrier.small : carrier.sizes;
  const rows: string[] = [];
  for (const n of sizes) {
    for (const object of carrier.objects(n)) {
      const value = applyDefinition(ce, definition, carrier.box(ce, object));
      // Only integer-valued statistics are FindStat's; a boolean or a list is not one.
      if (typeof value.re !== "number" || !Number.isInteger(value.re)) {
        rows.length = 0;
        break;
      }
      rows.push(`${carrier.spell(object)} => ${value.re}`);
    }
    if (!rows.length) break;
  }
  if (!rows.length) {
    process.stdout.write(`${signature}: not integer-valued, skipped\n`);
    continue;
  }
  const { ids: found, values } = crawlDir
    ? findInCrawl(carrier, definition, rows, ce)
    : { ids: await find(carrier.domain, rows.join("\n")), values: rows.length };
  process.stdout.write(`${signature}: ${found.join(" ") || "—"} (${values} values)\n`);
  if (found.length) {
    matches.push({
      head: definition.head,
      on: definition.on,
      findstat: found,
      values,
    });
  }
}

if (!only) {
  writeFileSync(
    new URL("../../symbols/combinatorics/combinatorics/findstat/src/findstat-data.ts", import.meta.url),
    `// GENERATED by packages/reference/scripts/find-findstat.ts — do not edit by hand.
//
// Which FindStat statistics each of ours is, decided by VALUE: every object of the carrier
// up to a size, our definition evaluated on each, and FindStat's finder asked what agrees
// exactly (no offset, every value). Regenerate with:
//
//   vp node packages/reference/scripts/find-findstat.ts
//
// or offline against a local crawl (see that script's header).

/** One statistic of ours and the FindStat statistics that agree with it on every value tried. */
export interface FindStatMatch {
  readonly head: string;
  readonly on: string;
  /** More than one means they agree on everything this small; a bigger sweep separates them. */
  readonly findstat: readonly string[];
  /** How many (object, value) pairs the match rests on. */
  readonly values: number;
}

export const findstat: readonly FindStatMatch[] = ${JSON.stringify(matches, null, 2)};
`,
  );
  process.stdout.write(`${matches.length} statistics matched\n`);
}
