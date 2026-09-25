import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { ComputeEngine as Engine } from "@cortex-js/compute-engine";
import { operandsOf, stringAt, symbolNameOf } from "@enumeratio/boxed";
import { expect, test } from "vite-plus/test";
import { declareAestimatio } from "../src/index.ts";

const ce = new Engine();
declareAestimatio(ce);
const box = (expr: unknown) => ce.box(expr as Parameters<ComputeEngine["box"]>[0]);

/** A `TestResultObject`'s `Outcome` rule value, read back as a plain string. */
const outcomeOf = (result: BoxedExpression): unknown => {
  const outcome = operandsOf(result).find((rule) => stringAt(operandsOf(rule)[0]) === "Outcome");
  const value = outcome === undefined ? undefined : operandsOf(outcome)[1];
  return value === undefined ? undefined : (stringAt(value) ?? symbolNameOf(value));
};

test("VerificationTest reports Success when the value matches", () => {
  const result = box(["VerificationTest", ["Add", 2, 3], 5]).evaluate();
  expect(result.operator).toBe("TestResultObject");
  expect(outcomeOf(result)).toBe("Success");
});

test("VerificationTest reports Failure when the value does not match", () => {
  const result = box(["VerificationTest", ["Add", 2, 3], 6]).evaluate();
  expect(outcomeOf(result)).toBe("Failure");
});

test("VerificationTest reports Aborted when its TimeConstraint fires", () => {
  const slow = ["Sum", ["Mod", "k", 97], ["Tuple", "k", 1, 500_000_000]];
  const result = box(["VerificationTest", slow, 0, ["KeyValuePair", "TimeConstraint", 0.02]]).evaluate();
  expect(outcomeOf(result)).toBe("Aborted");
});

test("VerificationTest with no expected output is Success whenever input evaluates", () => {
  const result = box(["VerificationTest", ["Add", 2, 3]]).evaluate();
  expect(outcomeOf(result)).toBe("Success");
});

test("VerificationTest's MemoryConstraint in-process is an Error, not silently ignored", () => {
  const result = box([
    "VerificationTest",
    ["Add", 2, 3],
    5,
    ["KeyValuePair", "MemoryConstraint", 1_000_000],
  ]).evaluate();
  expect(outcomeOf(result)).toBe("Error");
});
