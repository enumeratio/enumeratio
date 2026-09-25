import { expect, test } from "vite-plus/test";
import { collectErrors, deepEqual } from "../src/assert.ts";

test("deepEqual on MathJSON", () => {
  expect(deepEqual(10, 10)).toBe(true);
  expect(deepEqual(["Rational", 5, 6], ["Rational", 5, 6])).toBe(true);
  expect(deepEqual(["List", 1, 2], ["List", 1, 2, 3])).toBe(false);
  expect(deepEqual(["Rational", 5, 6], ["Rational", 6, 5])).toBe(false);
  expect(deepEqual({ num: "1" }, { num: "1" })).toBe(true);
});

test("deepEqual lets a float's last digits differ, as the reference tests do", () => {
  const complex = (re: number, im: number) => ["Complex", re, im];
  expect(
    deepEqual(complex(0.022241142609992593, -0.1032), complex(0.022241142609992697, -0.1032)),
  ).toBe(true);
  expect(deepEqual({ num: "1.2020569031595942" }, { num: "1.2020569031595943" })).toBe(true);
  expect(deepEqual(complex(0.0222411, -0.1032), complex(0.0222412, -0.1032))).toBe(false);
  expect(deepEqual(10, 11)).toBe(false); // integers stay exact
  expect(deepEqual(0.5, "0.5")).toBe(false);
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
