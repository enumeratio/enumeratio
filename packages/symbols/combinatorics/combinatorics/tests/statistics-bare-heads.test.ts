import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { ALL_STATISTICS, declareCombinatorics } from "../src/index.ts";

// One small object per carrier.
const SAMPLE: Record<string, unknown> = {
  Permutation: ["At", ["Permutations", 4], 7],
  IntegerPartition: ["At", ["IntegerPartitions", 5], 3],
  DyckPath: ["At", ["DyckPaths", 4], 5],
  SetPartition: ["At", ["SetPartitions", 4], 6],
};

test("every statistic is callable by its bare head on each of its carriers", () => {
  const ce = bareEngine();
  declareCombinatorics(ce);
  const failures: string[] = [];
  for (const { head, on } of ALL_STATISTICS) {
    const sample = SAMPLE[on];
    if (sample === undefined) {
      failures.push(`${head}@${on}: no sample`);
      continue;
    }
    const subject = ce.box(sample as never).evaluate();
    const bare = ce.box([head, subject.json] as never).evaluate();
    const viaStat = ce.box(["CombinatorialStat", subject.json, `'${head}'`] as never).evaluate();
    if (bare.operator === "Error" || JSON.stringify(bare.json) !== JSON.stringify(viaStat.json))
      failures.push(`${head}@${on}: ${JSON.stringify(bare.json)} vs ${JSON.stringify(viaStat.json)}`);
  }
  expect(failures).toEqual([]);
});
