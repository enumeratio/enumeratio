import { expect, test } from "vite-plus/test";
import { verdictOf } from "../scripts/oracle-verdict.ts";
import { DEFAULT_LANE_MINUTES, inLaneOrder, laneMinutes, verdictArguments } from "../scripts/plausible-lanes.ts";

// Plausible runs each lane under its own budget and judges a sample as the scan judges an example.

test("each lane has a budget, overridable for all of them", () => {
  expect(laneMinutes("mpmath")).toBe(DEFAULT_LANE_MINUTES);
  expect(laneMinutes("rust")).toBeGreaterThan(0);
  expect(laneMinutes("julia")).toBeGreaterThan(0);
  expect(laneMinutes("rust", "2")).toBe(2);
  expect(laneMinutes("julia", "0.5")).toBe(0.5);
  expect(() => laneMinutes("rust", "0")).toThrow(/positive/);
  expect(() => laneMinutes("rust", "soon")).toThrow(/positive/);
});

test("a sample is judged with the digits it asks for and the call it came from, and no template tolerance", () => {
  const call = ["N", ["Sin", 1], 6];
  const args = verdictArguments("julia", call, { num: "0.841471" }, { value: "0.841471" });
  expect(args).toEqual(["julia", { num: "0.841471" }, { value: "0.841471" }, undefined, true, call]);
  expect(verdictArguments("rust", ["Sin", 1], 0.84, { value: "0.84" })[4]).toBe(false);
});

test("Julia's N(x, d) digits must match to the last, as in the scan", () => {
  const call = ["N", "Pi", 10];
  const ours = { num: "3.141592654" };
  // Within the comparison's tolerance, but a wrong last digit.
  expect(verdictOf(...verdictArguments("julia", call, ours, { value: "3.141592653" }))).toBe("disagree");
  expect(verdictOf(...verdictArguments("julia", call, ours, { value: "3.141592654" }))).toBe("agree");
});

test("Rust's doubles compare relatively and its integers exactly, as in the scan", () => {
  // Noise never agrees with zero; the Python lanes' absolute floor would let it.
  expect(verdictOf(...verdictArguments("rust", ["Sin", 0], 0, { value: "1e-17" }))).toBe("disagree");
  const sin = 0.8414709848078965;
  expect(verdictOf(...verdictArguments("rust", ["Sin", 1], sin, { value: String(sin) }))).toBe("agree");
  const big = { num: "1000000000000000000000000" };
  expect(verdictOf(...verdictArguments("rust", ["Power", 10, 24], big, { value: "1000000000000000000000001" }))).toBe(
    "disagree",
  );
});

test("a lane's order is a permutation that depends on the night and the lane, and is repeatable", () => {
  const ids = Array.from({ length: 50 }, (_, i) => `Head/example-${i}`);
  const order = (seed: string, system: "julia" | "rust") => inLaneOrder(ids, seed, system, (id) => id);
  expect(order("2026-10-16", "julia")).toEqual(order("2026-10-16", "julia"));
  expect(order("2026-10-16", "julia").toSorted()).toEqual(ids.toSorted());
  expect(order("2026-10-16", "julia")).not.toEqual(ids);
  expect(order("2026-10-16", "julia")).not.toEqual(order("2026-10-17", "julia"));
  expect(order("2026-10-16", "julia")).not.toEqual(order("2026-10-16", "rust"));
});
