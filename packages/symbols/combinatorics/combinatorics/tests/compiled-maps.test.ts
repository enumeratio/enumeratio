// Maps compiled at build from their Epsil (src/compiled-maps.generated.js): every compiled map
// gives the interpreter's answers exactly, over the small elements of every family on its
// source carrier.

import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { CARRIERS } from "../src/carriers.ts";
import { COMPILED_MAPS } from "../src/compiled-maps.generated.js";
import { fastDefinition } from "../src/compiled.ts";
import { evaluateDefinition, MAPS } from "../src/maps.ts";
import { smallElements } from "../scripts/samples.ts";

// The interpreter is the slow side of the comparison: a small sample in the standard run, more
// under DEEP_TESTS.
const DEEP = process.env.DEEP_TESTS === "1";
const MAX_SIZE = DEEP ? 6 : 4;
const PER_FAMILY = DEEP ? 60 : 6;

const carrierByType = new Map(CARRIERS.map((carrier) => [carrier.type, carrier]));

/** Small elements of every family whose elements are values of `carrier`, as its contents. */
const subjectsOf = (carrier: string): unknown[] => smallElements(ce, carrier, MAX_SIZE, PER_FAMILY);

const ce = bareEngine();

test("the build compiled maps", () => {
  expect(Object.keys(COMPILED_MAPS).length).toBeGreaterThan(0);
});

// Every map compiled ahead of time, run from its generated code, against the interpreter. A map
// the generator left interpreted (its compiled code disagreed) has no code to run.
for (const map of MAPS.filter((m) => COMPILED_MAPS[`${m.name}@${m.from}`]?.run !== undefined)) {
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
