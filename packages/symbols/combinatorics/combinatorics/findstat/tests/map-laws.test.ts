// A map's stated laws (its record's `laws:`, read by scripts/generate-map-laws.ts) never contradict
// the MapProperties of the FindStat map it agrees with by value (../src/findstat-maps-data.ts),
// read from the committed slice. A law may say less than FindStat: only what it implies is checked.

import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { CARRIERS } from "../../src/carriers.ts";
import { type MapLaws, mapLaws } from "../../scripts/generate-map-laws.ts";
import { findstatMaps } from "../src/findstat-maps-data.ts";

interface Snapshot {
  readonly items: Readonly<Record<string, { readonly properties?: readonly string[] }>>;
}
const { items } = JSON.parse(readFileSync(new URL("../data/maps.json", import.meta.url), "utf8")) as Snapshot;

/** The FindStat properties one of our maps' laws implies. */
function impliedProperties(laws: MapLaws): string[] {
  const implied: string[] = [];
  for (const law of laws.laws ?? []) {
    if (law === "involution") implied.push("Involution", "Bijection");
    else if (law === "idempotent") implied.push("Idempotent");
    else implied.push("Bijection"); // `{ inverse }`: a map with an inverse is a bijection.
  }
  if (laws.orderIsomorphism !== undefined) implied.push("Bijection");
  return implied;
}

const TYPE_OF = new Map(CARRIERS.map((carrier) => [carrier.name, carrier.type]));
const LAWS = mapLaws();

test("no stated law of ours contradicts FindStat's MapProperties for the matched map", () => {
  const contradictions: string[] = [];
  for (const match of findstatMaps) {
    const laws = LAWS.get(`${match.name}@${TYPE_OF.get(match.from)}`);
    if (laws === undefined) continue;
    for (const { id } of match.findstat) {
      expect(items[id], `${id} is in the committed slice`).toBeDefined();
      const properties = items[id]?.properties ?? [];
      for (const property of impliedProperties(laws))
        if (!properties.includes(property)) contradictions.push(`${match.name} (${id}): ${property}`);
    }
  }
  expect(contradictions).toEqual([]);
});
