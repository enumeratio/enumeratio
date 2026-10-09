import { expect, test } from "vite-plus/test";
import { applyFunction, box, type Json } from "../src/index.ts";
import { bareEngine } from "../src/testing.ts";

// Compared as boxed MathJSON, so both sides are canonicalised the same way.
const expectCall = (f: Json, args: Json[], expected: Json): void => {
  const ce = bareEngine();
  const result = applyFunction(
    ce,
    box(ce, f),
    args.map((arg) => box(ce, arg)),
  );
  expect(result.json).toEqual(box(ce, expected).json);
};

const list: Json = ["List", 1, 2, 3];

test("a Function literal binds a list argument whole", () => {
  expectCall(["Function", ["g", "x"], "x"], [list], ["g", list]);
  expectCall(["Function", ["List", "x", "x"], "x"], [list], ["List", list, list]);
});

test("slot-only bodies bind by slot number", () => {
  expectCall(["Function", ["g", "_2", "_1"]], [1, 2], ["g", 2, 1]);
});

test("a bound slot in head position is called", () => {
  expectCall(["Function", ["_2", "_1"]], ["x", "a"], ["a", "x"]);
});

test("a nested Function keeps its own parameter", () => {
  const inner: Json = ["Function", ["h", "_1", "y"], "_1"];
  expectCall(["Function", ["m", inner, "_1"], "_1"], [["List", 1]], ["m", inner, ["List", 1]]);
  // The outer name still reaches under a nested Function that doesn't rebind it.
  expectCall(
    ["Function", ["m", ["Function", ["h", "x", "y"], "y"], "x"], "x"],
    [list],
    ["m", ["Function", ["h", list, "y"], "y"], list],
  );
});

test("a nested Function renames a parameter that the argument would be captured by", () => {
  const curried: Json = ["Function", ["Function", ["Power", "y", "x"], "x"], "y"];
  expectCall(curried, ["x"], ["Function", ["Power", "x", "x1"], "x1"]);
  const ce = bareEngine();
  const inner = applyFunction(ce, box(ce, curried), [box(ce, "x")]);
  expect(applyFunction(ce, inner, [box(ce, "y")]).json).toEqual(box(ce, ["Power", "x", "y"]).json);
});
