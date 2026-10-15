import { bareEngine } from "@enumeratio/engine/testing";
import { declareStructures } from "@enumeratio/structures";
import { describe, expect, it } from "vite-plus/test";
import { declareCombinatorics } from "../../src/index.ts";

// A host declares structures last (its `late` step); the other order must agree.
const engines = {
  "structures first": () => {
    const ce = bareEngine();
    declareStructures(ce);
    declareCombinatorics(ce);
    return ce;
  },
  "structures last": () => {
    const ce = bareEngine();
    declareCombinatorics(ce);
    declareStructures(ce);
    return ce;
  },
};

const finset = (n: number, ...members: number[]) => ["Finset", ["Tuple", n, ["List", ...members]]];

for (const [order, make] of Object.entries(engines)) {
  describe(`a Finset's Max, Min and Length (${order})`, () => {
    const ce = make();
    const evaluate = (json: unknown) => ce.box(json as never).evaluate().json;

    it("reads its members", () => {
      expect(evaluate(["Max", finset(6, 1, 3, 4)])).toBe(4);
      expect(evaluate(["Min", finset(6, 1, 3, 4)])).toBe(1);
      expect(evaluate(["Length", finset(6, 1, 3, 4)])).toBe(3);
    });

    it("answers the empty one as an empty list does", () => {
      expect(evaluate(["Max", finset(3)])).toEqual(evaluate(["Max", ["List"]]));
      expect(evaluate(["Min", finset(3)])).toEqual(evaluate(["Min", ["List"]]));
      expect(evaluate(["Length", finset(3)])).toBe(0);
    });

    it("keeps a Finset wrapped in a list one value, as before", () => {
      expect(evaluate(["Max", ["List", finset(6, 1, 3, 4)]])).toEqual(finset(6, 1, 3, 4));
    });
  });
}
