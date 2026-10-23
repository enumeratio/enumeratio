// Check combinatorial maps against EVERY FindStat row in a local crawl of its MapsDatabase
// (read-only, outside the repo).
//
//   vp node packages/symbols/combinatorics/combinatorics/findstat/scripts/check-findstat-maps.ts <crawl>/MapsDatabase [Head@Carrier=Mp00064 ...] [--max-size N]
//
// `find-findstat-maps.ts --crawl` holds each match to the rows up to size 6 when it writes
// `findstat-maps-data.ts`; this re-checks them (or a pair given here) over every row of the
// table, and names the disagreeing rows. A pair names the map by its head and SOURCE carrier,
// since a head such as `Reverse` is one map per carrier.
//
// Each row is read three ways: FindStat's image text, the independent JS reading
// (`../tests/map-findstat-readings.ts`, which must reproduce the image text exactly), and the
// declared head applied to the object, whose result must be the carrier value of the image.
//
// With no pairs, checks every match in `findstat-maps-data.ts`. Exits 1 on any disagreement.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { bareEngine } from "@enumeratio/engine/testing";
import { CARRIERS, declareCombinatorics, declareMaps } from "../../src/index.ts";
import { COLLECTION_CARRIER, objectSize, readObject } from "../src/objects.ts";
import { findstatMaps } from "../src/findstat-maps-data.ts";
import { MAP_READINGS } from "../tests/map-findstat-readings.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { "max-size": { type: "string" } },
});
const [dir, ...pairs] = positionals;
if (!dir) throw new Error("usage: check-findstat-maps.ts <MapsDatabase dir> [Head@Carrier=MpId ...] [--max-size N]");
const maxSize = values["max-size"] === undefined ? Number.POSITIVE_INFINITY : Number(values["max-size"]);

/** Every `[head, source carrier, id]` to check: the pairs given, else the generated matches. */
const targets: [head: string, from: string, id: string][] =
  pairs.length > 0
    ? pairs.map((pair) => {
        const [map, id] = pair.split("=") as [string, string];
        const [head, from] = map.split("@") as [string, string];
        return [head, from, id];
      })
    : findstatMaps.flatMap((m) => m.findstat.map((a): [string, string, string] => [m.name, m.from, a.id]));

const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((carrier) => [carrier.type, carrier.name])));

const normalize = (text: string): string => text.replace(/\s+/g, "");
const readable = (carrier: string, text: string): unknown => {
  try {
    return readObject(carrier, text);
  } catch {
    return undefined;
  }
};

let failed = false;
for (const [head, from, id] of targets) {
  const table = JSON.parse(readFileSync(`${dir}/${id}.json`, "utf8")) as {
    MapDomain: string;
    MapCodomain: string;
    MapData: Record<string, string>;
  };
  const to = COLLECTION_CARRIER[table.MapCodomain];
  if (COLLECTION_CARRIER[table.MapDomain] !== from || to === undefined)
    throw new Error(`${id} is ${table.MapDomain} -> ${table.MapCodomain}, not a map from ${from}`);
  const reading = MAP_READINGS[`${head}@${from}`];
  let rows = 0;
  let unreadable = 0;
  const bad: string[] = [];
  for (const [object, image] of Object.entries(table.MapData)) {
    if ((objectSize(from, object) ?? 0) > maxSize) continue;
    rows++;
    const x = readable(from, object);
    const y = readable(to, image);
    if (x === undefined || y === undefined) {
      unreadable++;
      continue;
    }
    if (reading !== undefined && normalize(reading(object)) !== normalize(image))
      bad.push(`${object}: reading ${reading(object)}, FindStat ${image}`);
    let ours: unknown;
    try {
      ours = ce.box([head, x] as never).evaluate().json;
    } catch (error) {
      ours = `threw ${String(error)}`;
    }
    if (JSON.stringify(ours) !== JSON.stringify(y))
      bad.push(`${object}: ours ${JSON.stringify(ours)}, FindStat ${image}`);
  }
  failed ||= bad.length > 0;
  const verdict = bad.length > 0 ? `DISAGREE ${bad.length}\n  ${bad.slice(0, 3).join("\n  ")}` : "ok";
  const how = reading === undefined ? "no reading" : "reading agrees";
  console.log(`${head}@${from} ${id} ${rows} rows, ${unreadable} unreadable (${how}): ${verdict}`);
}
if (failed) process.exitCode = 1;
