import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// NoneTrue
test("NoneTrue is the negation of Any", () => {
  const list = ["List", 4, 6, 9];
  expect(run(["NoneTrue", list, "IsPrime"])).toEqual(run(["Not", ["Any", list, "IsPrime"]]));
});
