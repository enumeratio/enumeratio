import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { applyAllPatches, lerchPhiReal } from "../src/index.ts";

// Φ(0, s, a) = a^(−s). A negative base to a non-integer float power is complex on the principal
// branch (mpmath: −0.05399760899362249 − 0.004079056397704415i); compute-engine's own Power and
// LerchPhi read it as a real odd root and return 0.05415….

const ce = new ComputeEngine();
applyAllPatches(ce);

const value = (call: unknown, mode: "evaluate" | "N") => {
  const v = mode === "N" ? ce.box(call as never).N() : ce.box(call as never).evaluate();
  return JSON.stringify(v.json);
};

test("Φ(0, 2.976, −2.664) takes the principal branch on evaluate and .N()", () => {
  for (const call of [
    ["LerchPhi", 0, 2.976, -2.664],
    ["LerchPhi", ["Complex", 0, 0], 2.976, -2.664],
  ])
    for (const mode of ["evaluate", "N"] as const)
      expect(value(call, mode)).toMatchInlineSnapshot(`"["Complex",-0.05399760899362249,-0.004079056397704416]"`);
});

test("a complex base takes the principal branch too", () => {
  expect(value(["LerchPhi", 0, 2.976, ["Complex", -2.664, 0.5]], "N")).toMatchInlineSnapshot(
    `"["Complex",-0.041633470761645905,-0.030198566384005213]"`,
  );
});

test("an exact power or an integer order still evaluates exactly", () => {
  expect(value(["LerchPhi", 0, 2, -3], "evaluate")).toMatchInlineSnapshot(`"["Rational",1,9]"`);
  expect(value(["LerchPhi", 0, ["Rational", 3, 2], -2], "N")).toMatchInlineSnapshot(
    `"["Complex",0,0.3535533905932738]"`,
  );
});

test("past the engine's default digits it stays unevaluated rather than answer in a double", () => {
  const high = new ComputeEngine();
  applyAllPatches(high);
  high.precision = 40;
  expect(JSON.stringify(high.box(["LerchPhi", 0, 2.976, -2.664] as never).N().json)).toMatchInlineSnapshot(
    `"["LerchPhi",0,2.976,-2.664]"`,
  );
});

test("the compiled real path has no real value to give: NaN", () => {
  expect(lerchPhiReal(0, 2.976, -2.664)).toBeNaN();
  expect(lerchPhiReal(0, 2, -3)).toBeCloseTo(1 / 9, 15);
  expect(lerchPhiReal(0.5, 2.976, 2)).toBeGreaterThan(0);
});
