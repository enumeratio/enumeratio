// A map runs compiled wherever compute-engine's compiler takes its definition. The compiled
// form must give the interpreter's answers exactly: checked here for every map whose body
// compiles, over the small elements of every family on its source carrier.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { allEntries, type FamilyKernel } from "../collections/src/index.ts";
import { CARRIERS } from "../src/carriers.ts";
import { compileTyped, fastDefinition } from "../src/compiled.ts";
import { evaluateDefinition, MAPS } from "../src/maps.ts";

// The interpreter is the slow side of the comparison: a small sample in the standard run, more
// under DEEP_TESTS.
const DEEP = process.env.DEEP_TESTS === "1";
const MAX_SIZE = DEEP ? 6 : 4;
const PER_FAMILY = DEEP ? 60 : 6;

const toJson = (element: unknown): unknown => (Array.isArray(element) ? ["List", ...element.map(toJson)] : element);

const carrierByType = new Map(CARRIERS.map((carrier) => [carrier.type, carrier]));

/** Small elements of every one-parameter family whose elements are values of `carrier`. */
function subjectsOf(carrier: string): unknown[] {
  const families = allEntries.filter((f: FamilyKernel) => f.carrier === carrier && f.paramCount === 1);
  const out: unknown[] = [];
  for (const family of families)
    for (let n = 0; n <= MAX_SIZE; n++) {
      const count = Number(family.count([n]));
      if (!Number.isFinite(count)) continue;
      for (let r = 0; r < Math.min(count, PER_FAMILY); r++) out.push(toJson(family.unrank([n], BigInt(r) as never)));
    }
  return out;
}

const ce = new ComputeEngine();
let compiledAny = false;

for (const map of MAPS.filter((m) => m.body !== undefined && m.extra === undefined)) {
  const from = carrierByType.get(map.from);
  const to = carrierByType.get(map.to);
  if (from === undefined || to === undefined) continue;
  // Only a definition the compiler takes runs compiled; the rest are interpreted anyway.
  if (compileTyped(ce, map.body, { _raw: from.shape }) === undefined) continue;
  test(`${map.name} from ${map.from}: compiled agrees with interpreted`, () => {
    let fallbacks = 0;
    const run = fastDefinition({
      ce,
      body: map.body,
      guard: map.guard,
      from: from.shape,
      to: to.shape,
      interpret: (contents) => {
        fallbacks++;
        return evaluateDefinition(ce, map, contents);
      },
    });
    const subjects = subjectsOf(from.name);
    for (const contents of subjects)
      expect(run(contents), JSON.stringify(contents)).toEqual(evaluateDefinition(ce, map, contents));
    if (fallbacks < subjects.length) compiledAny = true;
  });
}

test("the compiler takes at least some definitions", () => {
  expect(compiledAny).toBe(true);
});
