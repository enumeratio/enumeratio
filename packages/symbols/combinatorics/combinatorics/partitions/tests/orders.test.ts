import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareStructures } from "@enumeratio/structures";
import { describe, expect, it } from "vite-plus/test";
import { declareDomains } from "../../domains/src/index.ts";

// Integer partitions under dominance: a lattice, not a total order.
const ce = new ComputeEngine();
declareStructures(ce);
declareDomains(ce);

const P = (...parts: number[]) => ["IntegerPartition", ["List", ...parts]];
const evaluate = (json: unknown) => ce.box(json as never).evaluate().json;

describe("integer partitions under dominance", () => {
  const cases: [unknown, unknown][] = [
    [["Compare", P(4, 2), P(3, 3)], 1],
    [["Compare", P(3, 1, 1, 1), P(2, 2, 2)], "NaN"],
    // Incomparable: Min is the meet, Max the join.
    [["Min", P(3, 1, 1, 1), P(2, 2, 2)], P(2, 2, 1, 1)],
    [["Max", P(3, 1, 1, 1), P(2, 2, 2)], P(3, 2, 1)],
    [["Min", ["List", P(4, 2), P(3, 3), P(2, 2, 2)]], P(2, 2, 2)],
    [["Clamp", P(6), P(2, 2, 2), P(3, 3)], P(3, 3)],
    // Different n: not one lattice, so no meet.
    [
      ["Min", P(4, 2), P(3)],
      ["Min", P(4, 2), P(3)],
    ],
  ];
  for (const [input, expected] of cases) it(JSON.stringify(input), () => expect(evaluate(input)).toEqual(expected));

  it("meets and joins every pair of partitions of 7 to a lower and an upper bound", () => {
    const partitions = (n: number, max = n): number[][] =>
      n === 0
        ? [[]]
        : Array.from({ length: Math.min(n, max) }, (_, i) => i + 1).flatMap((k) =>
            partitions(n - k, k).map((p) => [k, ...p]),
          );
    const all = partitions(7);
    const cmp = (a: unknown, b: unknown) => evaluate(["Compare", a, b]);
    for (const a of all)
      for (const b of all) {
        const [x, y] = [P(...a), P(...b)];
        const meet = evaluate(["Min", x, y]);
        const join = evaluate(["Max", x, y]);
        expect([cmp(meet, x), cmp(meet, y)].every((c) => c === -1 || c === 0)).toBe(true);
        expect([cmp(join, x), cmp(join, y)].every((c) => c === 1 || c === 0)).toBe(true);
      }
  });
});
