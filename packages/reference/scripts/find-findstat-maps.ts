// Which FindStat maps each of ours IS, decided by VALUE: for each of our maps between carriers
// whose text FindStat's we read (`findstat/src/objects.ts`), every row of FindStat's own table
// for a map between the same collections (from the snapshot's crawl, `collect-findstat-data.ts`)
// whose object has size at most `MAX_SIZE` is read, our map applied to it, and the result compared
// with FindStat's image. A table with no disagreeing row, and with every row of size at most
// `FLOOR_SIZE` read on both sides, is that map. Rewrites `findstat/src/findstat-maps-data.ts`.
//
//   node packages/reference/scripts/find-findstat-maps.ts [--crawl DIR]

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CARRIERS, MAPS } from "@enumeratio/combinatorics";
import {
  COLLECTION_CARRIER,
  objectSize,
  readableCarriers,
  readObject,
} from "../../symbols/combinatorics/combinatorics/findstat/src/objects.ts";
import { declaredEngine } from "./engines.ts";

const { values } = parseArgs({
  options: { crawl: { type: "string", default: join(homedir(), "Playground/@enumeratio/findstat-crawl") } },
});

/** FindStat's collections whose objects we read. */
const READABLE = new Set(readableCarriers());
const COLLECTION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(COLLECTION_CARRIER).filter(([, carrier]) => READABLE.has(carrier)),
);
/** The largest object compared: a full check of the rows FindStat's tables hold through this size. */
const MAX_SIZE = 6;
/** Every row this small must be read and agree for a match: the 153 permutations of at most five entries. */
const FLOOR_SIZE = 5;

const carrierName = (type: string): string => CARRIERS.find((c) => c.type === type)?.name ?? type;
/** The carrier value of FindStat's text, or `undefined` when it isn't one we read or doesn't parse. */
const readable = (carrier: string, text: string): unknown => {
  try {
    return readObject(carrier, text);
  } catch {
    return undefined;
  }
};
const sizeOf = (carrier: string, text: string): number => {
  try {
    return objectSize(carrier, text) ?? Number.NaN;
  } catch {
    return Number.NaN;
  }
};
const folder = join(values.crawl!, "MapsDatabase");
const theirs = readdirSync(folder)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ id: f.replace(/\.json$/, ""), ...JSON.parse(readFileSync(join(folder, f), "utf8")) }))
  .filter((m) => COLLECTION[m.MapDomain] && COLLECTION[m.MapCodomain]);

const ce = declaredEngine();
/** Whether our map sends `x` to FindStat's image `y`. A map that throws on an object doesn't agree on it. */
const agrees = (ours: string, x: unknown, y: unknown): boolean => {
  try {
    const image = ce.box(["CombinatorialMap", x, `'${ours}'`] as never).evaluate().json;
    return JSON.stringify(image) === JSON.stringify(y);
  } catch {
    return false;
  }
};

/** FindStat's map, and how its table was read against ours. */
interface Agreement {
  readonly id: string;
  /** Rows in FindStat's table. */
  readonly rows: number;
  /** Rows of size at most `MAX_SIZE` read on both sides; every one agrees with ours. */
  readonly compared: number;
  /** Rows of size at most `MAX_SIZE` whose object or image we can't read, so not compared. */
  readonly skipped: number;
}
const matches: { name: string; from: string; to: string; findstat: Agreement[] }[] = [];
const dropped: string[] = [];
for (const ours of MAPS) {
  const from = carrierName(ours.from);
  const to = carrierName(ours.to);
  const findstat: Agreement[] = [];
  for (const m of theirs) {
    if (COLLECTION[m.MapDomain] !== from || COLLECTION[m.MapCodomain] !== to) continue;
    const table = Object.entries(m.MapData as Record<string, string>);
    let compared = 0;
    let skipped = 0;
    let unreadableSmall = false;
    let disagrees = false;
    for (const [object, image] of table) {
      const size = sizeOf(from, object);
      if (size > MAX_SIZE) continue;
      const x = readable(from, object);
      const y = readable(to, image);
      // An unknown size (NaN) counts as small: it can't be ruled out of the floor.
      if (x === undefined || y === undefined || Number.isNaN(size)) {
        skipped++;
        if (!(size > FLOOR_SIZE)) unreadableSmall = true;
        continue;
      }
      compared++;
      if (!agrees(ours.name, x, y)) {
        disagrees = true;
        break;
      }
    }
    if (disagrees) continue;
    if (unreadableSmall) {
      dropped.push(`  ${ours.name} (${from} → ${to}) ${m.id}: a row of size at most ${FLOOR_SIZE} is unreadable`);
      continue;
    }
    findstat.push({ id: m.id, rows: table.length, compared, skipped });
  }
  if (findstat.length > 0) matches.push({ name: ours.name, from, to, findstat });
}

const body = matches
  .map(
    (m) =>
      `  { name: ${JSON.stringify(m.name)}, from: ${JSON.stringify(m.from)}, to: ${JSON.stringify(m.to)}, findstat: [\n${m.findstat
        .map(
          (a) =>
            `    { id: ${JSON.stringify(a.id)}, rows: ${a.rows}, compared: ${a.compared}, skipped: ${a.skipped} },`,
        )
        .join("\n")}\n  ] },`,
  )
  .join("\n");
writeFileSync(
  new URL("../../symbols/combinatorics/combinatorics/findstat/src/findstat-maps-data.ts", import.meta.url),
  `// GENERATED by packages/reference/scripts/find-findstat-maps.ts — do not edit by hand.
//
// Which FindStat maps each of ours is, decided by VALUE: our map applied to each row of FindStat's
// own table whose object has size at most ${MAX_SIZE} (rows beyond that are not compared), compared with its
// image. A table matches when no compared row disagrees and every row of size at most ${FLOOR_SIZE} is read on
// both sides. Regenerate with:
//
//   node packages/reference/scripts/find-findstat-maps.ts

/** FindStat's map, and how its table was read against ours. */
export interface FindStatAgreement {
  /** FindStat's id, e.g. \`Mp00064\`. */
  readonly id: string;
  /** Rows in FindStat's table. */
  readonly rows: number;
  /** Rows of size at most ${MAX_SIZE} read on both sides; every one agrees with ours. */
  readonly compared: number;
  /** Rows of size at most ${MAX_SIZE} that can't be read, so not compared. */
  readonly skipped: number;
}

/** One map of ours and the FindStat maps that agree with it on every compared row. */
export interface FindStatMapMatch {
  readonly name: string;
  readonly from: string;
  readonly to: string;
  /** More than one means they agree on every row of each. */
  readonly findstat: readonly FindStatAgreement[];
}

export const findstatMaps: readonly FindStatMapMatch[] = [
${body}
];
`,
);
console.log(`${matches.length} of ${MAPS.length} maps matched`);
for (const m of matches)
  for (const a of m.findstat)
    console.log(
      `  ${m.name} (${m.from} → ${m.to}) = ${a.id}: ${a.compared} compared of ${a.rows} rows, ${a.skipped} skipped`,
    );
if (dropped.length > 0) console.log(`dropped (no disagreement, below the floor):\n${dropped.join("\n")}`);
