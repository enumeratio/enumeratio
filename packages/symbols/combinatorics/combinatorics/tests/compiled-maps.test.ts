// Maps compiled ahead of time from their Epsil (src/compiled-maps.generated.js): the generated
// module is current, and every compiled map gives the interpreter's answers exactly, over the
// small elements of every family on its source carrier.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { allEntries, type FamilyKernel } from "../collections/src/index.ts";
import { CARRIERS } from "../src/carriers.ts";
import { compiledMaps } from "../scripts/compile-maps.ts";
import { COMPILED_MAPS } from "../src/compiled-maps.generated.js";
import { fastDefinition } from "../src/compiled.ts";
import { evaluateDefinition, MAPS } from "../src/maps.ts";

// The interpreter is the slow side of the comparison: a small sample in the standard run, more
// under DEEP_TESTS.
const DEEP = process.env.DEEP_TESTS === "1";
const MAX_SIZE = DEEP ? 6 : 4;
const PER_FAMILY = DEEP ? 60 : 6;

const toJson = (element: unknown): unknown => (Array.isArray(element) ? ["List", ...element.map(toJson)] : element);

const carrierByType = new Map(CARRIERS.map((carrier) => [carrier.type, carrier]));

/** Small elements of every family whose elements are values of `carrier`: one-parameter
 *  families at sizes up to MAX_SIZE, two-parameter ones (n, k) at k ≤ n. */
function subjectsOf(carrier: string): unknown[] {
  const families = allEntries.filter((f: FamilyKernel) => f.carrier === carrier && f.paramCount <= 2);
  const out: unknown[] = [];
  for (const family of families)
    for (let n = 0; n <= MAX_SIZE; n++)
      for (const params of family.paramCount === 1 ? [[n]] : Array.from({ length: n + 1 }, (_, k) => [n, k])) {
        const count = Number(family.count(params));
        if (!Number.isFinite(count)) continue;
        for (let r = 0; r < Math.min(count, PER_FAMILY); r++)
          out.push(toJson(family.unrank(params, BigInt(r) as never)));
      }
  return out;
}

const ce = new ComputeEngine();

test("the compiled module is current (rerun scripts/compile-maps.ts)", () => {
  const current = Object.fromEntries(compiledMaps().map((e) => [e.key, e.hash]));
  const generated = Object.fromEntries(Object.entries(COMPILED_MAPS).map(([key, e]) => [key, e.hash]));
  expect(generated).toEqual(current);
}, 60_000);

// Every map compiled ahead of time, run from its generated code, against the interpreter.
for (const map of MAPS.filter((m) => COMPILED_MAPS[`${m.name}@${m.from}`] !== undefined)) {
  const from = carrierByType.get(map.from)!;
  const to = carrierByType.get(map.to)!;
  test(`${map.name} from ${map.from}: compiled agrees with interpreted`, () => {
    let fallbacks = 0;
    const run = fastDefinition({
      ce,
      body: map.body,
      guard: map.guard,
      from: from.shape,
      to: to.shape,
      cache: false,
      generated: COMPILED_MAPS[`${map.name}@${map.from}`],
      interpret: (contents) => {
        fallbacks++;
        return evaluateDefinition(ce, map, contents);
      },
    });
    const subjects = subjectsOf(from.name);
    for (const contents of subjects)
      expect(run(contents), JSON.stringify(contents)).toEqual(evaluateDefinition(ce, map, contents));
    // The generated code answered, not the interpreter.
    expect(fallbacks).toBeLessThan(subjects.length);
  });
}
