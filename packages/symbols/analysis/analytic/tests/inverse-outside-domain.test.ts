import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Routes agree: a rational past its real domain evaluates to a closed form whose N() is the
// complex principal value native N() already gives for the same number as a float. The
// closed forms themselves are reference examples (checked against mpmath and Wolfram).

const ce = createEngine(declareAnalytic);

const HEADS = ["Arcsin", "Arccos", "Arcsec", "Arccsc", "Arcosh", "Artanh", "Arcoth", "Arsech"];
const RATIONALS: [number, number][] = [
  [2, 1],
  [-2, 1],
  [3, 2],
  [-5, 3],
  [7, 1],
  [1, 2],
  [-1, 2],
  [3, 5],
  [-4, 7],
];

const parts = (json: unknown): [number, number] => {
  const num = (x: unknown): number => (typeof x === "number" ? x : Number((x as { num: string }).num));
  if (Array.isArray(json) && json[0] === "Complex") return [num(json[1]), num(json[2])];
  return [num(json), 0];
};

test("the exact reduction and the float route give one principal value", () => {
  for (const head of HEADS)
    for (const [p, q] of RATIONALS) {
      const exact = ce.box([head, q === 1 ? p : ["Rational", p, q]] as never);
      const viaExact = parts(exact.evaluate().N().json);
      const viaFloat = parts(ce.box([head, p / q] as never).N().json);
      expect(viaExact[0], `${head}(${p}/${q}) re`).toBeCloseTo(viaFloat[0], 9);
      expect(viaExact[1], `${head}(${p}/${q}) im`).toBeCloseTo(viaFloat[1], 9);
    }
});

test("an inverse folds back through its function past the domain", () => {
  expect(ce.box(["Cos", ["Arccos", 2]]).evaluate().json).toBe(2);
  expect(ce.box(["Sec", ["Arcsec", ["Rational", 1, 2]]]).evaluate().json).toEqual(["Rational", 1, 2]);
  expect(ce.box(["Sech", ["Arsech", -2]]).evaluate().json).toBe(-2);
});
