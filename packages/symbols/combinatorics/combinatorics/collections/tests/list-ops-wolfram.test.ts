import { bareEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareCollections } from "../src/library.ts";

const ce = bareEngine();
declareCollections(ce);
const run = (expr: unknown) => ce.box(expr as never).evaluate().json;

// NoneTrue
test("NoneTrue is the negation of Any", () => {
  const list = ["List", 4, 6, 9];
  expect(run(["NoneTrue", list, "IsPrime"])).toEqual(run(["Not", ["Any", list, "IsPrime"]]));
});

// A free symbol has no `.ops`, same as an empty `List` — `Gather`/`SortBy` must not read
// that as "an empty (already-grouped/sorted) collection" (A-126 farm scan; see
// list-frontier.ts's Accumulate note).
test("Gather(data, test) stays unevaluated for a free data", () => {
  expect(run(["Gather", "data", "test"])).toEqual(["Gather", "data", "test"]);
});
test("SortBy(exprs, err) stays unevaluated for a free exprs", () => {
  expect(run(["SortBy", "exprs", "err"])).toEqual(["SortBy", "exprs", "err"]);
});
