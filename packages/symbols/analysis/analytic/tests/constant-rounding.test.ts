import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";

// Floor/Ceil/Round of an exact constant, their idempotence, Max/Min's idempotence and
// exact-constant comparison, and IsOdd at a non-integer exact constant -- all from
// constant-rounding.ts. Exact integers and symbolic forms throughout, not a golden file.

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalJson = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Floor/Ceil/Round fold an exact constant expression", () => {
  expect(evalJson(["Floor", "Pi"])).toEqual(3);
  expect(evalJson(["Floor", ["Negate", "Pi"]])).toEqual(-4);
  expect(evalJson(["Floor", ["Multiply", 1000, "ExponentialE"]])).toEqual(2718);
  expect(evalJson(["Ceil", "Pi"])).toEqual(4);
  expect(evalJson(["Ceil", ["Log", 1000, 2]])).toEqual(10);
  expect(evalJson(["Round", "Pi"])).toEqual(3);
  expect(evalJson(["Round", ["Multiply", 100, "ExponentialE"]])).toEqual(272);
  // A free variable is untouched -- Add/Multiply/Log survive with x, and N() is not finite.
  expect(evalJson(["Floor", "x"])).toEqual(["Floor", "x"]);
  expect(evalJson(["Floor", ["Add", "x", 1]])).toEqual(["Floor", ["Add", "x", 1]]);
  // A plain float or exact rational is untouched -- native already handles those.
  expect(evalJson(["Floor", 2.7])).toEqual(2);
  expect(evalJson(["Floor", ["Rational", 7, 2]])).toEqual(3);
});

test("Floor/Ceil/Round are idempotent", () => {
  expect(evalJson(["Floor", ["Floor", "x"]])).toEqual(["Floor", "x"]);
  expect(evalJson(["Ceil", ["Ceil", "x"]])).toEqual(["Ceil", "x"]);
  expect(evalJson(["Round", ["Round", "x"]])).toEqual(["Round", "x"]);
});

test("Max/Min drop an exactly-repeated argument", () => {
  expect(evalJson(["Max", "x", "x"])).toEqual("x");
  expect(evalJson(["Min", "x", "x"])).toEqual("x");
  expect(evalJson(["Max", 3, "x", 5])).toEqual(["Max", 5, "x"]); // untouched: no repeat
});

test("Max/Min compare a pool of exact constants numerically, keeping the exact form", () => {
  expect(evalJson(["Max", ["List", "ExponentialE", "Pi", 2]])).toEqual("Pi");
  expect(evalJson(["Min", ["List", "ExponentialE", "Pi", 5]])).toEqual("ExponentialE");
  // A pool of plain numbers is untouched -- native already handles it.
  expect(evalJson(["Max", ["List", 3, 1, 4]])).toEqual(4);
});

test("IsOdd is False at a non-integer exact constant", () => {
  expect(evalJson(["IsOdd", "Pi"])).toEqual("False");
  expect(evalJson(["IsOdd", 3])).toEqual("True");
  expect(evalJson(["IsOdd", "x"])).toEqual(["IsOdd", "x"]);
});
