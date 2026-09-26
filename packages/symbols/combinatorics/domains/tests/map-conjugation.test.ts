// Shard of map.test.ts: the conjugate-of-cycle-type map, ArcRepresentation, and
// DescentComposition. See map-helpers.ts for shared setup.
import { expect, test } from "vite-plus/test";
import { ALL, conjugateOf, cycleTypeOf, perm, restrictedGrowthStrings, result } from "./map-helpers.ts";

test("ConjugateAfterCycleType is the conjugate of the cycle type", () => {
  for (const p of ALL) {
    expect(result(["ConjugateAfterCycleType", perm(...p)]), `[${p}]`).toEqual(["List", ...conjugateOf(cycleTypeOf(p))]);
  }
});

test("ArcRepresentation links each position to the next in its block", () => {
  // The reference: for position i, the smallest LATER position sharing i's label, or i itself
  // when none does — exactly the standard arc representation, read as a function.
  const linking = (rgs: number[]): number[] =>
    rgs.map((label, i) => {
      for (let j = i + 1; j < rgs.length; j++) if (rgs[j] === label) return j + 1;
      return i + 1;
    });
  for (const n of [1, 2, 3, 4, 5])
    for (const rgs of restrictedGrowthStrings(n))
      expect(result(["ArcRepresentation", ["SetPartition", ["List", ...rgs]]]), `${rgs}`).toEqual([
        "List",
        ...linking(rgs),
      ]);
});

test("DescentComposition cuts n at the descents", () => {
  for (const p of ALL) {
    const descents = p
      .slice(0, -1)
      .map((_, k) => k + 1)
      .filter((i) => p[i - 1]! > p[i]!);
    const bounds = [0, ...descents, p.length];
    const parts = bounds.slice(1).map((b, k) => b - bounds[k]!);
    expect(result(["DescentComposition", perm(...p)]), `[${p}]`).toEqual(["List", ...parts]);
    expect(
      parts.reduce((a, b) => a + b, 0),
      `[${p}] sums to n`,
    ).toBe(p.length);
    expect(parts.length, `[${p}] length`).toBe(descents.length + 1);
  }
});

test("the empty word has a composition with NO parts", () => {
  // Worth its own test because the obvious plain-loop reading gets it wrong: cutting [] at
  // its (nonexistent) descents gives [0], but a composition of 0 has no parts at all. The
  // expression was right and the reference was the artifact.
  expect(result(["DescentComposition", ["Permutation", ["List"]]])).toEqual(["List"]);
});
