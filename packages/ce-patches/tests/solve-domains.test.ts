import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);
const solve = (...ops: unknown[]) => ce.box(["Solve", ...ops] as never).evaluate().json;

const equal = (left: unknown, right: unknown) => ["Equal", left, right];
const power = (base: unknown, exponent: unknown) => ["Power", base, exponent];
const element = (unknown: string, domain: string) => ["Element", unknown, domain];

test("a symbolic root of an undecided domain membership declines, as the third argument or an Element", () => {
  // ±sqrt(a) is real only for a >= 0
  const quadratic = equal(power("x", 2), "a");
  expect(solve(quadratic, element("x", "RealNumbers"))).toEqual(["Solve", quadratic, element("x", "RealNumbers")]);
  expect(solve(quadratic, "x", "RealNumbers")).toEqual(["Solve", quadratic, element("x", "RealNumbers")]);
});

test("a symbolic root over the complexes is kept", () => {
  expect(solve(equal(power("x", 2), "a"), element("x", "ComplexNumbers"))).toEqual([
    "List",
    ["Sqrt", "a"],
    ["Negate", ["Sqrt", "a"]],
  ]);
});

test("a system over the integers keeps its integer solutions", () => {
  const system = ["List", equal(["Add", "x", "y"], 3), equal(["Subtract", "x", "y"], 1)];
  expect(solve(system, element("x", "Integers"), element("y", "Integers"))).toEqual(["List", ["Tuple", 2, 1]]);
  expect(solve(system, ["List", "x", "y"], "Integers")).toEqual(["List", ["Tuple", 2, 1]]);
});

test("a system whose solution leaves the domain has none", () => {
  const system = ["List", equal(["Add", "x", "y"], 2), equal(["Subtract", "x", "y"], 1)];
  expect(solve(system, element("x", "Integers"), element("y", "Integers"))).toEqual(["List"]);
  expect(solve(system, element("x", "RationalNumbers"), element("y", "RealNumbers"))).toEqual([
    "List",
    ["Tuple", ["Rational", 3, 2], ["Rational", 1, 2]],
  ]);
});

test("one unknown's domain filters its own component of a system", () => {
  const system = ["List", equal(["Add", "x", "y"], 2), equal(["Subtract", "x", "y"], 1)];
  expect(solve(system, element("x", "Integers"), "y")).toEqual(["List"]);
});

test("explicit roots are still filtered by a single domain", () => {
  expect(solve(equal(power("x", 2), 4), "x", "Integers")).toEqual(["List", 2, -2]);
  expect(solve(equal(power("x", 2), 4), element("x", "NonNegativeIntegers"))).toEqual(["List", 2]);
  expect(solve(equal(power("x", 2), -1), element("x", "RealNumbers"))).toEqual(["List"]);
  expect(solve(equal(power("x", 3), -1), element("x", "RealNumbers"))).toEqual(["List", -1]);
});
