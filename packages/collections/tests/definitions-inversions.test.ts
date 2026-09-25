// Shard of definitions.test.ts: Inversions, the single most expensive differential check (its
// reference definition maps a filter over every position, so it dominates the loop). See
// definitions-helpers.ts for shared setup.
import { expect, test } from "vite-plus/test";
import { ce, DEFINITIONS, evaluate, permutations } from "./definitions-helpers.ts";

const HEADS = ["Inversions"] as const;
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
