import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = bareEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate({ materialization: true }).json;

const abcd = ["List", "a", "b", "c", "d"];

test("Map(f)(xs) maps f over xs, as Map[f][xs] does", () => {
  expect(run(["Apply", ["Map", "f"], abcd])).toEqual(run(["Map", "f", abcd]));
  expect(run([["Map", "f"], abcd])).toEqual(["List", ["f", "a"], ["f", "b"], ["f", "c"], ["f", "d"]]);
});

test("Fold(f)(xs) folds from the first element", () => {
  expect(run(["Apply", ["Fold", "f"], abcd])).toEqual(["f", ["f", ["f", "a", "b"], "c"], "d"]);
});

test("Filter(pred)(xs) takes the list first, as Select[crit][xs] does", () => {
  expect(run(["Apply", ["Filter", "IsEven"], ["List", 1, 2, 4, 7, 6, 2]])).toEqual(["List", 2, 4, 6, 2]);
});

test("a bound slot in head position is called", () => {
  expect(run(["FoldList", ["Function", ["Block", ["_2", "_1"]], "_1", "_2"], "x", ["List", "a", "b"]])).toEqual([
    "List",
    "x",
    ["a", "x"],
    ["b", ["a", "x"]],
  ]);
  expect(
    run([
      "MapThread",
      ["Function", ["Block", ["_1", "_2"]], "_1", "_2"],
      ["List", ["List", "f", "g"], ["List", "x", "y"]],
    ]),
  ).toEqual(["List", ["f", "x"], ["g", "y"]]);
});

test("Do evaluates the bounds of its iterator", () => {
  const search = [
    "Do",
    ["If", ["IsPrime", "k"], ["Throw", "k"]],
    ["List", "k", ["Power", 10, 3], ["Add", ["Power", 10, 3], 10]],
  ];
  expect(run(["Catch", search])).toBe(1009);
});

test("Thread sees through Unevaluated", () => {
  const derivative = ["D", ["List", "x", ["Multiply", "x", "y"]], ["List", "x", "y"]];
  expect(run(["Thread", ["Unevaluated", derivative]])).toEqual(run(["Thread", derivative]));
});

test("Symbol of a non-string stays held", () => {
  expect(run(["Symbol", "x"])).toEqual(["Symbol", "x"]);
  expect(run(["Symbol", { str: "x" }])).toBe("x");
});
