// Plausible's carrier laws (https://github.com/enumeratio/enumeratio/wiki/Plausible §4.2): a map's laws — and its typing — hold for
// every value of its source carrier, so each is checked on elements drawn from every family
// over that carrier: pick a family, then an address in it, the way Plausible's Sum instance
// does. Seeded per map, so a failure replays.
//
// Moved here from @enumeratio/combinatorics' now-retired domains area (originally domains/tests/
// laws.test.ts) to break a devDependency cycle: combinatorics -> catalog -> combinatorics, once
// collections and domains merged into one package (https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible). catalog already devDeps combinatorics' public API for its own tests, so
// this moved to the side of the edge that doesn't cycle; the engine setup below was originally
// domains/tests/map-helpers.ts's, inlined since that helper was package-internal.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { allKernels, type FamilyKernel } from "@enumeratio/combinatorics/collections/src";
import { sampleable } from "@enumeratio/combinatorics/collections/sampleable";
import {
  CARRIERS,
  checkLaws,
  declareCombinatorics,
  declareMaps,
  type LawFailure,
  MAPS,
} from "@enumeratio/combinatorics/src";
import { streamFor } from "@enumeratio/plausible";
import { expect, test } from "vite-plus/test";

const constructorFor = Object.fromEntries(CARRIERS.map((c) => [c.type, c.name]));
const ce = new ComputeEngine();
// Carriers, families (typed) and statistics, area by area (step 6b/A-94); `declareMaps` stays
// out of `declareCombinatorics` and runs last (see `src/index.ts`'s file comment).
declareCombinatorics(ce);
declareMaps(ce, constructorFor);
const allEntries = allKernels(ce);

const SAMPLES = 24;
const MAX_SIZE = 6;
const BUDGET = 5_000n;

/** A family's carrier, when it's actually declared typed by one -- the same test
 *  `carrier-family-types.test.ts` uses, not the catalog's own (possibly stale) `carrier`
 *  label: a family the engine doesn't yet type has no carrier value for this test to draw. */
const carrierOf = (f: FamilyKernel): string | undefined => f.carrier;

const constructorOf = new Map(CARRIERS.map((c) => [c.type, c.name]));

/** The families over `carrier`, whose sampled elements this test can draw from `ce`. */
const familiesOver = (carrier: string | undefined): FamilyKernel[] =>
  allEntries.filter((f) => f.kind !== "scalar" && carrierOf(f) === carrier);

/** The element `family(...params)`'s `rank`-th member, read straight off `ce` -- every
 *  carrier-bearing family is declared typed (§4 step 5, A-94), so this IS a carrier value
 *  already, with no kernel-to-carrier table to rebuild it. `undefined` past the collection's
 *  enumeration limit (`Head::toobig`) or out of range. */
const elementAt = (family: FamilyKernel, params: number[], rank: bigint): unknown => {
  const index = rank + 1n;
  if (index > BigInt(Number.MAX_SAFE_INTEGER)) return undefined;
  const call = params.length === 0 ? family.head : [family.head, ...params];
  const element = ce.box(["At", call, Number(index)] as never).evaluate();
  return element.json === "Missing" || element.operator === "Error" ? undefined : element.json;
};

for (const map of MAPS.filter((m) => m.body !== undefined || m.composedOf !== undefined)) {
  const carrier = constructorOf.get(map.from) as string;
  const families = familiesOver(carrier);

  test.skipIf(carrier === undefined || families.length === 0)(
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
        const subject = elementAt(family, draw.address.params, draw.address.rank);
        if (subject === undefined) continue;
        const failure = checkLaws(ce, map, subject);
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
    .filter((m) => familiesOver(constructorOf.get(m.from)).length === 0)
    .map((m) => m.name);
  expect(unchecked).toEqual([]);
});
