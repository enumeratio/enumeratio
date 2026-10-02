import { ComputeEngine } from "@cortex-js/compute-engine";
import { compile } from "@cortex-js/compute-engine/compile";
import { describe, expect, test } from "vite-plus/test";
import { ensureRandom } from "../src/index.ts";

// One seed governs `Random` whether or not our stream has replaced compute-engine's draw.
const plain = () => new ComputeEngine();
const wired = () => {
  const ce = new ComputeEngine();
  ensureRandom(ce);
  return ce;
};

const seeded = (seed: number, body: unknown = ["Random"]) => ["WithRandomSeed", seed, body];

describe.each([
  ["plain compute-engine", plain],
  ["with ensureRandom", wired],
])("WithRandomSeed (%s)", (_name, make) => {
  const run = (ce: ComputeEngine, expr: unknown) => ce.box(expr as never).evaluate().json;

  test("the same seed gives the same draw, even after an unrelated draw", () => {
    const ce = make();
    const first = run(ce, seeded(7));
    run(ce, ["Random"]);
    expect(run(ce, seeded(7))).toEqual(first);
  });

  test("several draws under one seed reproduce", () => {
    const ce = make();
    const body = ["List", ["Random"], ["Random"], ["Random"]];
    const first = run(ce, seeded(7, body));
    expect(run(ce, seeded(7, body))).toEqual(first);
    expect(run(ce, seeded(8, body))).not.toEqual(first);
  });
});

describe("our draws inside a span", () => {
  test("Random over a collection and an interval reproduce under one seed", () => {
    const ce = wired();
    const run = (expr: unknown) => ce.box(expr as never).evaluate().json;
    const body = [
      "List",
      ["Random", ["List", 1, 2, 3, 4, 5, 6, 7, 8, 9]],
      ["Random", ["Interval", 0, 10]],
      ["Random", ["List", 1, 2, 3], 4],
    ];
    const first = run(seeded(11, body));
    run(["Random"]);
    expect(run(seeded(11, body))).toEqual(first);
  });

  test("nested spans restore the outer stream", () => {
    const ce = wired();
    const run = (expr: unknown) => ce.box(expr as never).evaluate().json;
    const nested = seeded(1, ["List", ["Random"], seeded(2), ["Random"]]);
    const first = run(nested);
    expect(run(nested)).toEqual(first);
    const [, outer1, inner, outer2] = first as unknown as unknown[];
    expect(inner).toEqual(run(seeded(2)));
    expect(outer1).not.toEqual(outer2);
  });

  test("an unseeded draw still reports its effect; a seeded one discharges it", () => {
    const ce = wired();
    const random = ce.box(["Random"]);
    const spanned = ce.box(seeded(7) as never);
    expect(random.effects).toContain("random");
    expect(spanned.effects ?? []).not.toContain("random");
  });
});

// #372: compiled code runs a `WithRandomSeed` body in the same frame, so a seed draws the
// same numbers evaluated and compiled. The seed is the compiled function's argument, so the
// draw isn't folded to a constant at compile time.
describe.each([
  ["plain compute-engine", plain],
  ["with ensureRandom", wired],
])("WithRandomSeed compiled agrees with evaluated (%s)", (_name, make) => {
  // A compiled list is a JavaScript array.
  const asJson = (value: unknown): unknown => (Array.isArray(value) ? ["List", ...value.map(asJson)] : value);
  const bodies: [string, unknown][] = [
    ["Random()", ["Random"]],
    // `RandomInteger(1, 100)` (collections) rewrites to this before it draws.
    ["an integer in a Range", ["Random", ["Range", 1, 100, 1]]],
    ["a pick from a collection", ["Random", ["List", 2, 3, 5, 7, 11, 13]]],
    ["an interval", ["Random", ["Interval", 0, 10]]],
    ["several draws", ["List", ["Random"], ["Random"], ["Random", ["Range", 1, 6, 1]]]],
  ];
  test.each(bodies)("%s", (_label, body) => {
    const ce = make();
    const compiled = compile(ce.box(["Function", ["WithRandomSeed", "s", body], "s"] as never)) as unknown as {
      success: boolean;
      run: (seed: number) => unknown;
    };
    expect(compiled.success).toBe(true);
    for (const seed of [1, 7, 42]) {
      const evaluated = ce.box(seeded(seed, body) as never).evaluate();
      expect(asJson(compiled.run(seed))).toEqual(evaluated.json);
    }
  });
});
