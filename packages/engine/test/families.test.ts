import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const str = (mj: any): string => ce.box(mj).evaluate().toString();
const sym = (mj: any): string => (ce.box(mj).evaluate() as any).symbol;

describe("closed-form Length across the six families (no walk)", () => {
  it("matches the known counting sequences", () => {
    expect(num(["Length", ["IntegerCompositions", 10]])).toBe(512); // 2^9
    expect(num(["Length", ["IntegerPartitions", 10]])).toBe(42); // p(10)
    expect(num(["Length", ["PartitionsIntoKParts", 10, 3]])).toBe(8); // p(10,3)
    expect(num(["Length", ["SetPartitions", 5]])).toBe(52); // Bell(5)
    expect(num(["Length", ["SetPartitionsIntoKBlocks", 5, 2]])).toBe(15); // S(5,2)
    expect(num(["Length", ["SetCompositions", 4]])).toBe(75); // Fubini(4)
  });
  it("empty families count 0", () => {
    expect(num(["Length", ["SetPartitionsIntoKBlocks", 4, 5]])).toBe(0); // S(4,5)=0
    expect(num(["Length", ["PartitionsIntoKParts", 3, 5]])).toBe(0); // no partition of 3 into 5 parts
  });
});

describe("At endpoints (1-based) — the off-by-one contract holds per family", () => {
  it("integer compositions of 4 run [4] … [1,1,1,1]", () => {
    expect(str(["At", ["IntegerCompositions", 4], 1])).toBe("[4]");
    expect(str(["At", ["IntegerCompositions", 4], 8])).toBe("[1,1,1,1]");
  });
  it("integer partitions of 5 run [5] … [1,1,1,1,1]", () => {
    expect(str(["At", ["IntegerPartitions", 5], 1])).toBe("[5]");
    expect(str(["At", ["IntegerPartitions", 5], 7])).toBe("[1,1,1,1,1]");
  });
  it("set partitions of 3 run [[1,2,3]] … [[1],[2],[3]]", () => {
    expect(str(["At", ["SetPartitions", 3], 1])).toBe("[[1,2,3]]");
    expect(str(["At", ["SetPartitions", 3], 5])).toBe("[[1],[2],[3]]");
  });
  it("set compositions of 2 keep block ORDER: [[1,2]], [[1],[2]], [[2],[1]]", () => {
    expect(str(["At", ["SetCompositions", 2], 1])).toBe("[[1,2]]");
    expect(str(["At", ["SetCompositions", 2], 2])).toBe("[[1],[2]]");
    expect(str(["At", ["SetCompositions", 2], 3])).toBe("[[2],[1]]");
  });
});

describe("membership per family", () => {
  it("compositions vs partitions", () => {
    expect(sym(["Element", ["List", 2, 1, 1], ["IntegerCompositions", 4]])).toBe("True");
    expect(sym(["Element", ["List", 1, 1, 1], ["IntegerCompositions", 4]])).toBe("False"); // sums to 3
    expect(sym(["Element", ["List", 3, 1, 1], ["PartitionsIntoKParts", 5, 3]])).toBe("True");
    expect(sym(["Element", ["List", 4, 1], ["PartitionsIntoKParts", 5, 3]])).toBe("False"); // 2 parts
  });
  it("set partitions", () => {
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 3]], ["SetPartitions", 3]])).toBe("True");
    expect(sym(["Element", ["List", ["List", 1, 2], ["List", 2]], ["SetPartitions", 3]])).toBe("False"); // 2 twice, 3 missing
    expect(sym(["Element", ["List", ["List", 1], ["List", 2]], ["SetPartitions", 3]])).toBe("False"); // 3 missing
  });
});

// The package's own differential, cheap by construction: enumerate the WHOLE family via At(1..N), and
// assert it is a bijection onto exactly N distinct, valid elements. An O(1) at makes this O(N) to check.
describe("enumerate-all bijection check (at is a bijection onto valid elements)", () => {
  const families: Array<{ name: string; coll: any }> = [
    { name: "SymmetricGroup(4)", coll: ["SymmetricGroup", 4] },
    { name: "IntegerCompositions(6)", coll: ["IntegerCompositions", 6] },
    { name: "IntegerPartitions(7)", coll: ["IntegerPartitions", 7] },
    { name: "PartitionsIntoKParts(9,3)", coll: ["PartitionsIntoKParts", 9, 3] },
    { name: "SetPartitions(4)", coll: ["SetPartitions", 4] },
    { name: "SetPartitionsIntoKBlocks(5,2)", coll: ["SetPartitionsIntoKBlocks", 5, 2] },
    { name: "SetCompositions(3)", coll: ["SetCompositions", 3] },
  ];
  for (const { name, coll } of families) {
    it(name, () => {
      const N = num(["Length", coll]);
      expect(N).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (let i = 1; i <= N; i++) {
        const el = ce.box(["At", coll, i]).evaluate();
        const s = el.toString();
        expect(el.operator === "List" || (el as any).ops != null).toBe(true); // a real element, not undefined
        seen.add(s);
        expect(sym(["Element", el, coll])).toBe("True"); // structurally a member
      }
      expect(seen.size).toBe(N); // distinct → injective on [1,N]; with count = closed form ⇒ bijection
      expect(ce.box(["At", coll, N + 1]).evaluate().operator).not.toBe("List"); // out of range → not an element
    });
  }
});
