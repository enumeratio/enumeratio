import { ComputeEngine } from "@cortex-js/compute-engine";
import { collectMessages, defineMessages } from "@enumeratio/engine";
import { expect, test } from "vite-plus/test";
import { applyPatch, factorIntegerInexact } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, factorIntegerInexact);
defineMessages(ce, "FactorInteger", { exact: "`1` is not an exact number." });
const value = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("an integer-valued float stays unevaluated and says why", () => {
  const { value: v, messages } = collectMessages(ce, () => value(["FactorInteger", { num: "12.0" }]));
  expect(v).toEqual(["FactorInteger", { num: "12.0" }]);
  expect(messages.map((m) => `${m.head}::${m.code}`)).toEqual(["FactorInteger::exact"]);
  expect(ce.box(["FactorInteger", { num: "12.0" }] as never).N().operator).toBe("FactorInteger");
});

test("exact integers still factor", () => {
  expect(value(["FactorInteger", 12])).toEqual(["List", ["Tuple", 2, 2], ["Tuple", 3, 1]]);
});
