// unstable: a test constructs its own engine
import { ComputeEngine } from "@enumeratio/engine/unstable";
import type { Json } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// FunctionRange of the oscillating special functions: the extrema are the derivative's first zeros,
// and the energy bound past the scanned window keeps every later oscillation inside them.
// Reference values are mpmath 1.3.0.

const ce = new ComputeEngine();
declareAnalytic(ce);

const range = (f: Json): Json => ce.box(["FunctionRange", f, "x", "y"]).evaluate().json as Json;

/** The numbers of a `LessEqual` condition in `y`, `undefined` for the side that is unbounded. */
function bounds(f: Json): [number | undefined, number | undefined] {
  const r = range(f) as [string, ...Json[]];
  expect(r[0]).toBe("LessEqual");
  return r.length === 4
    ? [r[1] as number, r[3] as number]
    : r[1] === "y"
      ? [undefined, r[2] as number]
      : [r[1] as number, undefined];
}

test("Airy functions: Ai is bounded both ways, Bi only below", () => {
  const [lo, hi] = bounds(["AiryAi", "x"]);
  expect(lo).toBeCloseTo(-0.41901547803256395, 13);
  expect(hi).toBeCloseTo(0.5356566560156999, 13);
  const [min, max] = bounds(["AiryBi", "x"]);
  expect(min).toBeCloseTo(-0.45494438363965733, 13);
  expect(max).toBeUndefined();
});

test("Bessel Y of integer order: bounded above only", () => {
  const maxima = {
    0: 0.5207864124022675,
    1: 0.4167299281064514,
    2: 0.36766391312822233,
    5: 0.297183683350638,
    10: 0.2463410476745919,
    20: 0.20109115808640746,
  };
  for (const [order, value] of Object.entries(maxima)) {
    const [lo, hi] = bounds(["BesselY", Number(order), "x"]);
    expect(lo).toBeUndefined();
    expect(hi, `Y${order}`).toBeCloseTo(value, 12);
  }
});

test("other orders and arguments are declined", () => {
  for (const f of [
    ["BesselY", ["Rational", 1, 2], "x"],
    ["BesselY", -1, "x"],
    ["BesselY", 1, ["Multiply", 2, "x"]],
    ["BesselJ", 0, "x"],
    ["AiryAi", ["Add", "x", 1]],
  ] as Json[]) {
    expect((range(f) as unknown as unknown[])[0], JSON.stringify(f)).toBe("FunctionRange");
  }
});
