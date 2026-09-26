// Plausible's carrier laws (design/plausible.md §4.2): a map's laws — and its typing — hold for
// every value of its source carrier, so each is checked on elements drawn from every family
// over that carrier: pick a family, then an address in it, the way Plausible's Sum instance
// does. Seeded per map, so a failure replays.

import { COLLECTIONS } from "@enumeratio/catalog/src";
import { allEntries, type FamilyKernel } from "@enumeratio/collections/src";
import { sampleable } from "@enumeratio/collections/sampleable";
import { streamFor } from "@enumeratio/plausible";
import { expect, test } from "vite-plus/test";
import { checkLaws, type LawFailure } from "../src/laws.ts";
import { ce, DOMAINS, MAPS } from "./map-helpers.ts";

const SAMPLES = 24;
const MAX_SIZE = 6;
const BUDGET = 5_000n;

const catalogCarrier = new Map(COLLECTIONS.map((c) => [c.name, c.carrier]));
const carrierOf = (f: FamilyKernel): string | undefined => f.declared?.carrier ?? catalogCarrier.get(f.head);

/** How a family's kernel element becomes a value of its carrier. Carriers whose storage differs
 *  from the kernel's (SetPartition is a growth string, the kernel's blocks) join as they're
 *  written. */
const CONSTRUCT: Record<string, (element: unknown) => unknown> = {
  Permutation: (element) => ["Permutation", ["List", ...(element as number[])]],
};

const constructorOf = new Map(DOMAINS.map((d) => [d.type, d.name]));

for (const map of MAPS.filter((m) => m.body !== undefined || m.composedOf !== undefined)) {
  const carrier = constructorOf.get(map.from) as string;
  const construct = CONSTRUCT[carrier];
  const families = allEntries.filter((f) => f.kind === "ints" && carrierOf(f) === carrier);

  test.skipIf(construct === undefined || families.length === 0)(
    `${map.name} keeps its laws over ${carrier}`,
    () => {
      const rng = streamFor("laws", map.name);
      const failures: LawFailure[] = [];
      let checked = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const family = families[Math.floor(rng() * families.length)] as FamilyKernel;
        const instance = sampleable(family);
        if ("untestable" in instance) continue;
        const draw = instance.draw(rng, 1 + (i % MAX_SIZE), BUDGET);
        if (!("address" in draw)) continue;
        const element = family.unrank(draw.address.params, draw.address.rank);
        const failure = checkLaws(ce, map, (construct as (e: unknown) => unknown)(element));
        checked++;
        if (failure !== undefined)
          failures.push({ ...failure, detail: `${failure.detail} (from ${instance.show(draw.address)})` });
      }
      expect(failures.slice(0, 3)).toEqual([]);
      expect(checked).toBeGreaterThan(0);
    },
    30_000,
  );
}

test("the empty permutation is a Permutation value, and its own image under each involution", () => {
  // S₀ has one element and every permutation family draws it at n = 0.
  const empty = ["Permutation", ["List"]];
  for (const map of ["Reverse", "Inverse", "Complement"])
    expect(ce.box([map, empty] as never).evaluate().json).toEqual(empty);
});

test("every map that declares laws gets them checked", () => {
  const unchecked = MAPS.filter((m) => (m.laws ?? []).length > 0)
    .filter((m) => CONSTRUCT[constructorOf.get(m.from) as string] === undefined)
    .map((m) => m.name);
  expect(unchecked).toEqual([]);
});
