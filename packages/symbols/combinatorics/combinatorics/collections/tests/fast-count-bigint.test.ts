import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { type EpsilFamily, kernelOn } from "../src/families/epsil.ts";

// A fast count past 2^53 as a double is rounded, so it is not trusted: Epsil answers instead.
const family: EpsilFamily = {
  head: "SyntheticFastCount",
  kind: "scalar",
  paramCount: 1,
  params: ["_n"],
  epsil: { count: 7, unrank: "_r", rank: 0, valid: "True" },
  fast: {
    count: () => 2 ** 60,
    unrank: () => 0,
    rank: () => 0,
    valid: () => true,
  },
};

test("a fast count that is a double past 2^53 is not used as the count", () => {
  expect(kernelOn(bareEngine(), family).count([3])).toBe(7n);
});
