import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { defineOverload, declareCompile, extendHead, widenSignature, wrapOperator } from "../src/index.ts";

// compute-engine lowers a head by name (`Sin` to `Math.sin`) only while its definition keeps the library's
// handlers: an extension whose `evaluate` was replaced is a shadow, and compiling it throws. A package says
// how the head compiles instead (`CompileStance`).
const compiled = (ce: ComputeEngine, expression: unknown): string | undefined => {
  try {
    return (new JavaScriptTarget().compile(ce.box(expression as never)) as { code?: string }).code;
  } catch {
    return undefined;
  }
};
const inert = () => () => undefined;

test("a replaced evaluate on an extension shadows the library head: compile fails closed", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, 1);
  expect(compiled(ce, ["Sin", "x"])).toBeUndefined();
});

test("a head that states 'builtin' keeps the target's lowering, after a signature or a flag extension", () => {
  const ce = new ComputeEngine();
  defineOverload(ce, "Sin", { package: "test", on: ["Interval"], written: true, evaluate: () => undefined });
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(compiled(ce, ["Sin", "x"])).toBe("Math.sin(_.x)");
});

test("one replacement that states nothing closes the head, whatever else states 'builtin'", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  wrapOperator(ce, ["Sin", 1], () => false, inert, 1);
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(compiled(ce, ["Sin", "x"])).toBeUndefined();
});

test("a head with a widened signature compiles up to its native operand count", () => {
  const ce = new ComputeEngine();
  widenSignature(ce, "Erf", "(number, number?) -> number");
  wrapOperator(ce, ["Erf", 1], () => false, inert, { compile: { upTo: 1 } });
  expect(compiled(ce, ["Erf", "x"])).toContain("erf(");
  expect(compiled(ce, ["Erf", "x", "y"])).toBeUndefined();
});

test("a lowering of its own answers, and declines to the built-in", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, {
    arity: 1,
    compile: (args) => (JSON.stringify(args[0]?.json) === '"y"' ? "SIN_OF_Y" : undefined),
  });
  expect(compiled(ce, ["Sin", "y"])).toBe("SIN_OF_Y");
  expect(compiled(ce, ["Sin", "x"])).toBe("Math.sin(_.x)");
});

test("a handler attached in place states its own stance", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  const operator = (ce.lookupDefinition("Sin") as { operator: { evaluate?: unknown } }).operator;
  operator.evaluate = () => undefined;
  expect(compiled(ce, ["Sin", "x"])).toBeUndefined();
  declareCompile(ce, "Sin", "builtin");
  expect(compiled(ce, ["Sin", "x"])).toBe("Math.sin(_.x)");
});

test("an overload row with no carrier can state 'builtin'", () => {
  const ce = new ComputeEngine();
  defineOverload(ce, "Sin", { package: "test", compile: "builtin", when: () => false, evaluate: () => undefined });
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(compiled(ce, ["Sin", "x"])).toBe("Math.sin(_.x)");
});
