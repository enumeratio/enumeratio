import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyPatch } from "../src/patch.ts";
import { roundPlaces } from "../src/patches/round-places.ts";

const ce = new ComputeEngine();
applyPatch(ce, roundPlaces);
const evaluate = (expr: unknown) => ce.box(expr as never).evaluate().json;

describe("ROUND TO DECIMAL PLACES", () => {
  const cases: [unknown, unknown][] = [
    [
      ["Round", 3.14159, 2],
      ["Rational", 157, 50],
    ],
    [
      ["Round", 2.5, 1],
      ["Rational", 5, 2],
    ],
    [["Round", 19.995, 2], 20],
    [["Round", -1.005, 1], -1],
    [["Round", 1234, -2], 1200],
    [["Round", 3.14159, 0], 3],
    [["Round", 2.5], 3],
  ];
  for (const [expr, expected] of cases) test(JSON.stringify(expr), () => expect(evaluate(expr)).toEqual(expected));
});
