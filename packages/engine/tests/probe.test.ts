import { expect, test } from "vite-plus/test";
import { box, isNativeHead, nativeEvaluate, withAssumptions } from "../src/index.ts";
import { bareEngine } from "../src/testing.ts";

test("isNativeHead sees compute-engine's heads and later declarations, and nothing else", () => {
  const ce = bareEngine();
  expect(isNativeHead(ce, "Add")).toBe(true);
  expect(isNativeHead(ce, "Pi")).toBe(true);
  expect(isNativeHead(ce, "NoSuchHead")).toBe(false);
  ce.declare("NoSuchHead", { signature: "(number) -> number" });
  expect(isNativeHead(ce, "NoSuchHead")).toBe(true);
});

test("nativeEvaluate captures the current handler, for a replacement to fall back on", () => {
  const ce = bareEngine();
  const native = nativeEvaluate(ce, "GCD");
  expect(native).toBeTypeOf("function");
  expect(nativeEvaluate(ce, "NoSuchHead")).toBeUndefined();
  expect(nativeEvaluate(ce, "Pi")).toBeUndefined();

  const definition = ce.lookupDefinition("GCD");
  const operator = (definition as { operator: { evaluate?: unknown } }).operator;
  operator.evaluate = (ops: readonly unknown[], options: unknown) =>
    ops.length === 0 ? ce.number(-1) : native?.(ops as never, options as never);
  // The capture is current at the time of the call: a second one sees the replacement.
  expect(nativeEvaluate(ce, "GCD")).not.toBe(native);
  expect(box(ce, ["GCD", 12, 18]).evaluate().json).toBe(6);
});

test("withAssumptions assumes inside the call only, and restores on a throw", () => {
  const ce = bareEngine();
  const x = box(ce, "x");
  const abs = box(ce, ["Abs", "x"]);
  expect(abs.evaluate().operator).toBe("Abs");
  const inside = withAssumptions(ce, [box(ce, ["Greater", "x", 0])], () => box(ce, ["Abs", "x"]).evaluate().json);
  expect(inside).toBe("x");
  expect(box(ce, ["Abs", "x"]).evaluate().operator).toBe("Abs");

  expect(() =>
    withAssumptions(ce, [box(ce, ["Greater", "x", 0])], () => {
      throw new Error("boom");
    }),
  ).toThrow("boom");
  expect(box(ce, ["Abs", "x"]).evaluate().operator).toBe("Abs");
  expect(x.isPositive).not.toBe(true);
});
