// Q1 in code: we EXTEND compute-engine, we do not reimplement it. After installEnumeratio, CE's
// entire standard library is untouched and live, and CE's own operators compose over our collection.
import { describe, it, expect } from "vitest";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { installEnumeratio } from "../src/index.js";

const ce = installEnumeratio(new ComputeEngine());
const str = (mj: any) => ce.box(mj).evaluate().toString();
const num = (mj: any) => Number((ce.box(mj).evaluate() as any).re);
const sym = (mj: any) => (ce.box(mj).evaluate() as any).symbol;

describe("CE's standard library is untouched by install", () => {
  it("arithmetic / number theory / collections all still evaluate", () => {
    expect(num(["Add", 2, 3])).toBe(5);
    expect(num(["Factorial", 6])).toBe(720);
    expect(num(["Fibonacci", 10])).toBe(55);
    expect(num(["Totient", 12])).toBe(4);
    expect(str(["Divisors", 12])).toBe("[1,2,3,4,6,12]");
  });
  it("CE's own Permutations(list) — the sibling head — keeps its arrangement semantics", () => {
    expect(num(["Length", ["Permutations", ["List", "a", "b", "c"]]])).toBe(6);
    expect(str(["At", ["Permutations", ["List", "a", "b", "c"]], 1])).toBe("[a,b,c]");
  });
});

describe("CE operators compose over OUR collection", () => {
  it("our count binds to CE's own number theory (not a private silo)", () => {
    expect(sym(["Equal", ["Length", ["SymmetricGroup", 12]], ["Factorial", 12]])).toBe("True");
  });
  it("CE scalar ops consume our element", () => {
    expect(num(["Length", ["At", ["SymmetricGroup", 9], 1]])).toBe(9); // CE Length over our word
    expect(num(["Sum", ["At", ["SymmetricGroup", 4], 24]])).toBe(10); // 4+3+2+1
    expect(num(["Last", ["At", ["SymmetricGroup", 4], 24]])).toBe(1);
    expect(num(["First", ["At", ["SymmetricGroup", 4], 24]])).toBe(4);
  });
  it("CE Map+Sum fold over our lazy collection (Map is function-first)", () => {
    // sum of the last entry across the first three permutations of [4]: 4 + 3 + 4 = 11
    const s = num(["Sum", ["Map", ["Function", ["Last", "p"], "p"], ["Take", ["SymmetricGroup", 4], 3]]]);
    expect(s).toBe(11);
  });
  it("our stat, mapped by CE over the whole family, reduced by CE", () => {
    // total inversions of S_3 = Σ inversions = 0+1+1+2+2+3 = 9
    expect(num(["Sum", ["Map", ["Function", ["Inversions", "p"], "p"], ["SymmetricGroup", 3]]])).toBe(9);
    // max inversions over S_5 = C(5,2) = 10, via CE's Max over our mapped stat
    expect(num(["Max", ["Map", ["Function", ["Inversions", "p"], "p"], ["SymmetricGroup", 5]]])).toBe(10);
  });
});
