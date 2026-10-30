// The compile steps' shard split: balanced by recorded cost, the hash split without one, and the
// same split every time for the same inputs (each process of a run computes it for itself).

import { describe, expect, it } from "vite-plus/test";
import { assignShards } from "../scripts/shards.ts";

const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);

describe("assignShards", () => {
  it("splits by hash without costs, covering every key", () => {
    const split = assignShards(keys, 3, {});
    expect([...split.keys()].toSorted()).toEqual(keys.toSorted());
    expect(new Set(split.values())).toEqual(new Set([0, 1, 2]));
  });

  it("does not depend on listing order", () => {
    const costs = Object.fromEntries(keys.map((k, i) => [k, (i * 37) % 11]));
    expect(assignShards(keys.toReversed(), 3, costs)).toEqual(assignShards(keys, 3, costs));
  });

  it("keeps one dear key from sharing a shard with the rest of the load", () => {
    const costs = { ...Object.fromEntries(keys.map((k) => [k, 1])), k0: 1000 };
    const split = assignShards(keys, 3, costs);
    const load = [0, 0, 0];
    for (const [k, shard] of split) load[shard]! += costs[k as keyof typeof costs];
    expect(load.toSorted((a, b) => a - b)).toEqual([14, 15, 1000]);
  });

  it("counts a key with no record as the median", () => {
    const split = assignShards(["a", "b", "c", "d"], 2, { a: 5, b: 5, c: 5 });
    const per = [0, 0];
    for (const shard of split.values()) per[shard]!++;
    expect(per).toEqual([2, 2]);
  });
});
