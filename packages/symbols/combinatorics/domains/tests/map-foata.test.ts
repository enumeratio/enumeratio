// Shard of map.test.ts: Foata's transformation against the plain-JS reading, both through the
// engine and (for the extended n <= 7 property check) purely in JS. See map-helpers.ts for
// shared setup.
import { expect, test } from "vite-plus/test";
import {
  ALL,
  cyclesOf,
  foataOf,
  leftToRightMaxima,
  perm,
  permutations,
  result,
} from "./map-helpers.ts";

test("Foata agrees with the cycle-rotation reading", () => {
  for (const p of ALL) {
    expect(result(["Foata", perm(...p)]), `[${p}]`).toEqual(["List", ...foataOf(p)]);
  }
});

test("Foata's defining property holds on S_n for n <= 7 (reference algorithm)", () => {
  // The same bijection + left-to-right-maxima check, over the plain JS reading rather than
  // the engine — `foataOf` is line-for-line the same construction the map body evaluates
  // (blocks from cycle maxima, values read off by iterating the permutation), and the
  // previous test already cross-checks the two agree for every n <= 5. This just extends the
  // property itself to n = 6, 7, where a CE `evaluate()` per permutation is too slow to run
  // exhaustively (roughly 5040 * 0.3s for S7 alone).
  for (let n = 1; n <= 7; n++) {
    const seen = new Set<string>();
    for (const p of permutations(n)) {
      const image = foataOf(p);
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
