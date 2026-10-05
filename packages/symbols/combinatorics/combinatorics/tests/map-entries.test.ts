import type { Engine } from "@enumeratio/engine";
import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatorics, declareMaps } from "../src/index.ts";
import { readEntries } from "@enumeratio/entry/node";

const entries = [
  // combinatorics' reference/ is now one directory shared by the collections and (former)
  // domains areas (recordDirs wants one `reference/` per package, https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible's step-1 merge); this file only means to re-check the maps
  // (originally `domains/reference/`), so it filters to entries that carry a map tag, bar the
  // generated placeholders for catalogued maps nothing here declares.
  ...readEntries(new URL("../../combinatorics/reference/", import.meta.url)).filter(
    (entry) => entry.mapOn !== undefined && entry.stub === undefined,
  ),
  // structures' heads over the carriers' tables need the carriers, so they run here.
  ...readEntries(new URL("../../../../structures/reference/", import.meta.url)).filter((entry) =>
    ["CombinatorialStat", "CombinatorialMap"].includes(entry.name),
  ),
];

// The same stack both engines declare, in the same order (A-94: declareCombinatorics is now
// the one call -- each area mints its own carriers alongside its own families, and its own
// statistics after them, step 6b).
const ce = bareEngine();
declareCombinatorics(ce);
declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

for (const entry of entries) {
  for (const example of entry.examples) {
    if (example.role === "triage") {
      test.skip(`${entry.name} example/${example.id} (triage: ${example.triage ?? "unbucketed"})`, () => {});
      continue;
    }
    const aspirational = example.role === "aspirational";
    test(`${entry.name} example/${example.id}${aspirational ? " (gap)" : ""}`, () => {
      const input = example.expr as unknown as Parameters<Engine["box"]>[0];
      const output = ce.box(input).evaluate().json;
      // An undefined map has no head to call, so its example is a claim about what it WOULD
      // answer. If this starts matching, the gap closed — drop `role: aspirational`.
      if (aspirational) expect(output).not.toEqual(example.expected);
      else expect(output).toEqual(example.expected);
    });
  }
}

test("every map entry carries an example", () => {
  const maps = entries.filter((entry) => entry.mapOn !== undefined);
  expect(maps.length).toBeGreaterThan(20);
  for (const entry of maps) expect(entry.examples.length, entry.name).toBeGreaterThan(0);
});
