import { expect, test } from "vite-plus/test";
import { collectErrors, deepEqual } from "../src/assert.ts";

test("deepEqual on MathJSON", () => {
  expect(deepEqual(10, 10)).toBe(true);
  expect(deepEqual(["Rational", 5, 6], ["Rational", 5, 6])).toBe(true);
  expect(deepEqual(["List", 1, 2], ["List", 1, 2, 3])).toBe(false);
  expect(deepEqual(["Rational", 5, 6], ["Rational", 6, 5])).toBe(false);
  expect(deepEqual({ num: "1" }, { num: "1" })).toBe(true);
});

test("collectErrors formats Error atoms", () => {
  expect(collectErrors(42)).toEqual([]);
  expect(collectErrors(["Add", 1, 2])).toEqual([]);
  expect(collectErrors(["Add", ["Error", ["ErrorCode", "'x'"]], 2])).toEqual(["x"]);
  expect(
    collectErrors([
      "Error",
      ["ErrorCode", "'incompatible-type'", "'integer'", "'vector<integer^3>'"],
    ]),
  ).toEqual(["type mismatch: expected integer, got vector<integer^3>"]);
});
