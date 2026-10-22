import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { roundTripJson } from "./round-trip.ts";

const ce = new ComputeEngine();
const read = (tex: string) => roundTripJson(ce.parse(tex));
const product = ["Multiply", ["Add", "x", 1], ["Add", "x", 2]] as never;

test("a held operand compares as compute-engine canonicalizes it", () => {
  for (const head of ["Simplify", "Hold"])
    expect(read(`\\mathrm{${head}}((x+1)(x+2))`)).toEqual(roundTripJson(ce.box([head, product])));
});

test("a wrong round trip under a held head still differs", () => {
  expect(read("\\mathrm{Simplify}((x+1)(x+3))")).not.toEqual(roundTripJson(ce.box(["Simplify", product])));
});

test("a non-lazy head is compared as written", () => {
  expect(read("(x+1)(x+3)")).not.toEqual(read("(x+1)(x+2)"));
});
