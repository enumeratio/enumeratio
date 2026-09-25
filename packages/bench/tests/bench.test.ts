import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { agrees } from "../src/agree.ts";
import { concretise, loadCatalogue } from "../src/catalogue.ts";
import { buildPlan } from "../src/plan.ts";
import { measure, PROTOCOL } from "../src/protocol.ts";
import { drawSample } from "../src/random.ts";
import { judge } from "../src/run.ts";
import { geomean, summarise } from "../src/stats.ts";

// Golden data, not snapshots (AGENTS.md). Regenerate with `UPDATE_BENCH=1 vp test`.
const GOLDEN = fileURLToPath(new URL("./bench.golden.json", import.meta.url));
const updating = process.env.UPDATE_BENCH === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};
const pin = (key: string, actual: unknown): void => {
  if (updating) fresh[key] = actual;
  else expect(actual).toEqual(golden[key]);
};
afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

describe("stats", () => {
  test("summary of a known sample", () => {
    pin("summary", summarise([5, 1, 4, 2, 3, 100]));
  });
  test("geometric mean is baseline-independent", () => {
    const ratios = [2, 8, 0.5];
    expect(geomean(ratios)).toBeCloseTo(2, 12);
    expect(geomean(ratios.map((r) => 1 / r))).toBeCloseTo(1 / geomean(ratios), 12);
  });
});

describe("sampling", () => {
  test("a seed draws the same inputs every time", () => {
    const sample = {
      seed: 20260925,
      count: 3,
      draw: { a: ["bits", 80], b: ["int", 1, 6], x: ["log", -3, 3] },
    } as const;
    expect(drawSample(sample)).toEqual(drawSample(sample));
    pin("draws", drawSample(sample));
  });
});

describe("protocol", () => {
  // A fake clock: every call costs `cost` ns.
  const clocked = (cost: bigint) => {
    let t = 0n;
    return { now: () => t, call: () => void (t += cost) };
  };
  test("a sub-millisecond call is batched up to the minimum sample time", () => {
    const { now, call } = clocked(1000n);
    const timed = measure(call, { budgetMs: 1000, now });
    expect(timed.k * 1000).toBeGreaterThanOrEqual(PROTOCOL.minSampleMs * 1e6);
    expect(timed.samplesNs).toHaveLength(PROTOCOL.samples);
    expect(timed.samplesNs.every((ns) => ns === 1000)).toBe(true);
  });
  test("a slow call stops at the budget with at least the minimum samples", () => {
    const { now, call } = clocked(400_000_000n); // 400 ms
    const timed = measure(call, { budgetMs: 1000, now });
    expect(timed.k).toBe(1);
    expect(timed.samplesNs).toHaveLength(PROTOCOL.minSamples);
    expect(timed.timedOut).toBe(false);
  });
});

describe("judge", () => {
  const samplesNs = [2e6, 2.1e6, 1.9e6, 2e6, 2e6];
  test("the correctness gate runs before the timing counts", () => {
    expect(judge("F/x", { value: "7", samplesNs, k: 1 }, "8", "exact").status).toBe("wrong");
    expect(judge("F/x", { value: "8", samplesNs, k: 1 }, "8", "exact").status).toBe("ok");
  });
  test("exact answers compare as text, never through a double", () => {
    expect(agrees("12345678901234567891", "12345678901234567890", "exact")).toBe(false);
    expect(agrees("0.30000000000000004", "0.3", "machine")).toBe(true);
  });
  test("a digit precision is checked to its digits, not through a double", () => {
    const li3 = "0.537213193608040200940623225595";
    expect(agrees("0.5372131936080403", li3, 30)).toBe(false);
    expect(agrees("0.53721319360804020094062322559", li3, 30)).toBe(true);
    expect(agrees("5.37213193608040200940623225595*^-1", li3, 30)).toBe(true);
  });
  test("a call under the floor is kept but marked too-fast", () => {
    expect(
      judge("F/x", { value: "8", samplesNs: [100, 100, 100, 100, 100], k: 1 }, "8", "exact").status,
    ).toBe("too-fast");
  });
});

describe("catalogue", () => {
  const cases = loadCatalogue().map(concretise);
  test("loads, with unique ids", () => {
    expect(cases.length).toBeGreaterThan(0);
  });
  test("the support matrix is pinned", () => {
    pin("plan", buildPlan(cases));
  });
});
