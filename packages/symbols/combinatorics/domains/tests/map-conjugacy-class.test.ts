// Shard of map.test.ts: ConjugacyClassRepresentative alone — the single most expensive test in
// the original file. See map-helpers.ts for shared setup.
import { expect, test } from "vite-plus/test";
import { ALL, canonicalRepresentative, cycleTypeOf, perm, result } from "./map-helpers.ts";

test("ConjugacyClassRepresentative is canonical and shares the cycle type", () => {
  for (const p of ALL) {
    const rep = canonicalRepresentative(p);
    expect(result(["ConjugacyClassRepresentative", perm(...p)]), `[${p}]`).toEqual(["List", ...rep]);
    expect(cycleTypeOf(rep), `[${p}] same cycle type`).toEqual(cycleTypeOf(p));
    // Already canonical: representing the representative is a no-op.
    expect(canonicalRepresentative(rep), `[${p}] idempotent`).toEqual(rep);
  }
});
