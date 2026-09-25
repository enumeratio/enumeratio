// Shard of definitions.test.ts: the remaining reference-vs-implementation differential checks.
// See definitions-helpers.ts for shared setup, and definitions-core.test.ts /
// definitions-inversions.test.ts for the rest.
import { expect, test } from "vite-plus/test";
import { ce, DEFINITIONS, evaluate, permutations } from "./definitions-helpers.ts";

const HEADS = ["Ascents", "MajorIndex", "MinorIndex", "FixedPoints", "Antiexcedances", "Peaks", "Valleys"] as const;
for (const head of HEADS) {
  const definition = DEFINITIONS[head];
  test(`${head}: the definition agrees with the implementation`, { timeout: 60_000 }, () => {
    for (let n = 0; n <= 6; n++) {
      for (const p of permutations(n)) {
        const native = ce.box([head, ["List", ...p]]).evaluate().re;
        expect(evaluate(definition, p), `${head}([${p}])`).toBe(native);
      }
    }
  });
}
