// Shard of map.test.ts: Foata's bijection property checked against the ENGINE's own output
// (rather than only the reference reading). See map-helpers.ts for shared setup, and
// map-foata.test.ts for the reference-algorithm-only extension of this property to n <= 7.
import { expect, test } from "vite-plus/test";
import { cyclesOf, leftToRightMaxima, perm, permutations, result } from "./map-helpers.ts";

test("Foata (via the engine) is a bijection on S_n for n <= 5, sending k cycles to k left-to-right maxima", () => {
  // The defining property of the first fundamental transformation, checked against the
  // ENGINE's own output rather than only the reference reading. Capped at n = 5 — each
  // `evaluate()` call here costs a few hundred ms regardless of n (boxing the map's
  // expression dominates), so S6 alone is minutes of wall time; see the n <= 7 check below
  // for the same property over the reference algorithm.
  for (let n = 1; n <= 5; n++) {
    const seen = new Set<string>();
    for (const p of permutations(n)) {
      const word = result(["Foata", perm(...p)]) as readonly unknown[];
      const image = word.slice(1) as number[];
      expect(
        image.slice().sort((a, b) => a - b),
        `[${p}] a permutation`,
      ).toEqual(Array.from({ length: n }, (_, k) => k + 1));
      seen.add(image.join(","));
      expect(leftToRightMaxima(image), `[${p}] maxima = cycles`).toBe(cyclesOf(p).length);
    }
    expect(seen.size, `S${n} bijective`).toBe(permutations(n).length);
  }
});
