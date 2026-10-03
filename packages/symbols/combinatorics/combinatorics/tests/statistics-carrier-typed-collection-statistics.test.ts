// BL-1 (typed family elements): a statistic over a family element must type-check with no
// wrapping by the caller, on an engine that declares carriers before collections (the real
// shape every production engine uses — cli, web, census, reference/scripts/engines.ts).
import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCombinatorics } from "../src/index.ts";

// The combinatorial statistics are declared inside `declareCombinatorics` itself now (step 6b).
const ce = new ComputeEngine();
declareCombinatorics(ce);

test("CycleCount(At(Permutations(5), 3)) evaluates directly, no wrapping", () => {
  const result = ce.box(["CycleCount", ["At", ["Permutations", 5], 3]]).evaluate();
  expect(result.operator).not.toBe("Error");
  expect(result.re).toBeTypeOf("number");
});

test("FixedPoints(_) == 0 over SymmetricGroup(5) finds all 44 derangements", () => {
  const matches = ce
    .box(["Count", ["Filter", ["SymmetricGroup", 5], ["Function", ["Equal", ["FixedPoints", "_1"], 0]]]])
    .evaluate();
  expect(matches.re).toBe(44);
});
