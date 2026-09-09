// The counting sequences as first-class scalar operators (heads CE lacks; Wolfram names), each Listable
// (threads element-wise over a List), plus the Groupings collection.
import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const num = (mj: any): number => Number((ce.box(mj).evaluate() as any).re);
const str = (mj: any): string => ce.box(mj).evaluate().toString();
const sym = (mj: any): string => (ce.box(mj).evaluate() as any).symbol;

describe("counting-sequence operators", () => {
  it("scalar values", () => {
    expect(num(["BellB", 5])).toBe(52);
    expect(num(["CatalanNumber", 6])).toBe(132);
    expect(num(["FubiniNumber", 4])).toBe(75);
    expect(num(["PartitionsP", 10])).toBe(42);
    expect(num(["PartitionsQ", 10])).toBe(10); // distinct partitions of 10
  });
  it("primary PascalCase-of-ident spellings match their Wolfram-alias counterparts", () => {
    expect(num(["BellNumber", 5])).toBe(num(["BellB", 5]));
    expect(num(["PartitionNumber", 10])).toBe(num(["PartitionsP", 10]));
  });
  it("PolygonalNumber: 1-arg triangular, 2-arg r-gonal", () => {
    expect(num(["PolygonalNumber", 5])).toBe(15); // T(5) = triangular
    expect(num(["PolygonalNumber", 3, 5])).toBe(15); // r=3 == triangular
    expect(num(["PolygonalNumber", 4, 5])).toBe(25); // squares: 5²
    expect(num(["PolygonalNumber", 5, 4])).toBe(22); // pentagonal(4)
    expect(num(["PolygonalNumber", 6, 4])).toBe(28); // hexagonal(4)
  });
  it("are Listable — thread over a List by default", () => {
    expect(str(["BellB", ["List", 0, 1, 2, 3, 4, 5]])).toBe("[1,1,2,5,15,52]");
    expect(str(["CatalanNumber", ["List", 0, 1, 2, 3, 4]])).toBe("[1,1,2,5,14]");
    expect(str(["PartitionsP", ["List", 1, 2, 3, 4, 5]])).toBe("[1,2,3,5,7]");
    expect(str(["PolygonalNumber", 4, ["List", 1, 2, 3, 4]])).toBe("[1,4,9,16]"); // squares
  });
  it("compose with CE's own operators", () => {
    expect(num(["Add", ["BellB", 4], ["CatalanNumber", 4]])).toBe(15 + 14); // 29
    // BellB threaded then summed by CE's Total-like Sum
    expect(num(["Sum", ["BellB", ["List", 1, 2, 3, 4]]])).toBe(1 + 2 + 5 + 15);
  });
});

describe("digit functions", () => {
  it("IntegerDigits: base, padding, and inverse via FromDigits", () => {
    expect(str(["IntegerDigits", 12345])).toBe("[1,2,3,4,5]");
    expect(str(["IntegerDigits", 255, 16])).toBe("[15,15]"); // 0xFF
    expect(str(["IntegerDigits", 5, 2])).toBe("[1,0,1]");
    expect(str(["IntegerDigits", 5, 2, 5])).toBe("[0,0,1,0,1]"); // left-pad to length 5
    expect(str(["IntegerDigits", 0])).toBe("[0]");
    expect(num(["FromDigits", ["List", 1, 2, 3, 4, 5]])).toBe(12345);
    expect(num(["FromDigits", ["List", 15, 15], 16])).toBe(255);
    expect(num(["FromDigits", ["IntegerDigits", 9999, 7], 7])).toBe(9999); // round-trip in base 7
  });
  it("IntegerDigits is Listable over n", () => {
    expect(str(["IntegerDigits", ["List", 10, 20, 30]])).toBe("[[1,0],[2,0],[3,0]]");
  });
  it("RealDigits returns [digits, exponent]", () => {
    expect(str(["RealDigits", 12345])).toBe("[[1,2,3,4,5],5]");
    expect(str(["RealDigits", 0])).toBe("[[0],1]");
    expect(str(["RealDigits", 255, 16])).toBe("[[15,15],2]");
  });
});

describe("integer / bit ops (CE-lacking; CE's own number theory stays bound)", () => {
  it("IntegerLength / IntegerReverse / DigitSum", () => {
    expect(num(["IntegerLength", 12345])).toBe(5);
    expect(num(["IntegerLength", 255, 16])).toBe(2);
    expect(num(["IntegerLength", 0])).toBe(0);
    expect(num(["IntegerReverse", 1230])).toBe(321);
    expect(num(["DigitSum", 12345])).toBe(15);
    expect(num(["DigitSum", 255, 16])).toBe(30);
  });
  it("DigitCount: per-digit (Wolfram order 1..b-1,0) and single-digit", () => {
    expect(str(["DigitCount", 1223334444, 10])).toBe("[1,2,3,4,0,0,0,0,0,0]"); // counts of 1,2,...,9,0
    expect(num(["DigitCount", 1223334444, 10, 3])).toBe(3); // count of digit 3
  });
  it("bit ops CE lacks", () => {
    expect(num(["BitAnd", 12, 10])).toBe(8);
    expect(num(["BitOr", 12, 10])).toBe(14);
    expect(num(["BitXor", 12, 10])).toBe(6);
  });
  it("Listable", () => {
    expect(str(["IntegerLength", ["List", 1, 22, 333]])).toBe("[1,2,3]");
    expect(str(["DigitSum", ["List", 9, 99, 999]])).toBe("[9,18,27]");
  });
  it("CE's own number theory still works after install (bound, not shadowed)", () => {
    expect(num(["Mod", 17, 5])).toBe(2);
    expect(num(["GCD", 12, 18])).toBe(6);
    expect(str(["Divisors", 12])).toBe("[1,2,3,4,6,12]");
    expect(num(["Totient", 12])).toBe(4);
  });
});

describe("Groupings collection (binary parenthesizations, Wolfram Groupings[n,2])", () => {
  it("count = Catalan(n-1); nested element", () => {
    expect(num(["Length", ["Groupings", 4]])).toBe(5); // Catalan(3)
    expect(num(["Length", ["Groupings", 5]])).toBe(14); // Catalan(4)
    expect(str(["At", ["Groupings", 3], 1])).toBe("[1,[2,3]]");
    expect(str(["At", ["Groupings", 3], 2])).toBe("[[1,2],3]");
    expect(str(["At", ["Groupings", 1], 1])).toBe("1"); // a single leaf
  });
  it("Rank inverts At", () => {
    const N = num(["Length", ["Groupings", 5]]);
    for (let i = 1; i <= N; i++) expect(num(["Rank", ["Groupings", 5], ce.box(["At", ["Groupings", 5], i]).evaluate()])).toBe(i);
  });
  it("membership", () => {
    expect(sym(["Element", ["List", ["List", 1, 2], 3], ["Groupings", 3]])).toBe("True");
    expect(sym(["Element", ["List", ["List", 2, 1], 3], ["Groupings", 3]])).toBe("False"); // leaves out of order
    expect(sym(["Element", ["List", 1, 2, 3], ["Groupings", 3]])).toBe("False"); // node arity != 2
  });
});
