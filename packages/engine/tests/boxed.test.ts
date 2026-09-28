import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { bigIntegerAt, integerAt, operandsOf, stringAt, wrapOperator } from "../src/index.ts";

const ce = new ComputeEngine();

test("operandsOf reads a function's arguments, and [] from anything else", () => {
  expect(operandsOf(ce.box(["List", 1, 2, 3])).map((x) => x.re)).toEqual([1, 2, 3]);
  expect(operandsOf(ce.box(7))).toEqual([]);
  expect(operandsOf(undefined)).toEqual([]);
});

test("integerAt reads real integers in the safe range", () => {
  expect(integerAt(ce.box(5))).toBe(5);
  expect(integerAt(ce.box(-3))).toBe(-3);
  expect(integerAt(ce.box(0))).toBe(0);
});

test("integerAt rejects rather than truncates", () => {
  // The membership path decodes user-supplied elements: truncating 1.5 would let it
  // read as the valid element 1 and report a false containment.
  expect(integerAt(ce.box(1.5))).toBeUndefined();
  expect(integerAt(ce.box(2 ** 53))).toBeUndefined();
  expect(integerAt(ce.box(["Complex", 1, 2]))).toBeUndefined();
  expect(integerAt(ce.box("x"))).toBeUndefined();
  expect(integerAt(undefined)).toBeUndefined();
});

test("bigIntegerAt reads machine and bignum integers alike", () => {
  expect(bigIntegerAt(ce.box(5))).toBe(5n);
  expect(bigIntegerAt(ce.box(-3))).toBe(-3n);
  expect(bigIntegerAt(ce.box(0))).toBe(0n);
  expect(bigIntegerAt(ce.box(10n ** 30n))).toBe(10n ** 30n);
  expect(bigIntegerAt(ce.box(-(10n ** 30n)))).toBe(-(10n ** 30n));
});

test("bigIntegerAt rejects non-integers", () => {
  expect(bigIntegerAt(ce.box(1.5))).toBeUndefined();
  expect(bigIntegerAt(ce.box(["Rational", 1, 3]))).toBeUndefined();
  expect(bigIntegerAt(ce.box(["Complex", 1, 2]))).toBeUndefined();
  expect(bigIntegerAt(ce.box("x"))).toBeUndefined();
  expect(bigIntegerAt(undefined)).toBeUndefined();
});

test("stringAt unwraps bare, String-wrapped and quoted spellings alike", () => {
  expect(stringAt(ce.string("LRL"))).toBe("LRL");
  expect(stringAt(ce.box(["String", ce.string("Subsets")]))).toBe("Subsets");
  expect(stringAt(ce.box(5))).toBeUndefined();
  expect(stringAt(undefined)).toBeUndefined();
});

test("wrapOperator with an arity skips calls of any other operand count", () => {
  const engine = new ComputeEngine();
  engine.declare("Probe", {
    signature: "(value+) -> value",
    evaluate: () => engine.symbol("Native"),
  });
  const seen: number[] = [];
  wrapOperator(
    engine,
    ["Probe", 1, 1],
    (ops) => {
      seen.push(ops.length);
      return true;
    },
    () => () => engine.symbol("Wrapped"),
    2,
  );
  expect(engine.box(["Probe", 1, 2]).evaluate().json).toBe("Wrapped");
  expect(engine.box(["Probe", 1, 2, 3]).evaluate().json).toBe("Native");
  expect(seen).toEqual([2]);
});
