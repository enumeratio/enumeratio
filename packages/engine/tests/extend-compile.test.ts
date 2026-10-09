import { ComputeEngine } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { compileExpression, compileTyped } from "../src/compiled.ts";
import { defineOverload, declareCompile, extendHead, refusing, widenSignature, wrapOperator } from "../src/index.ts";

// compute-engine lowers a head by name (`Sin` to `Math.sin`) only while its definition keeps the library's
// handlers: an extension whose `evaluate` was replaced is a shadow, and compiling it throws. A package says
// how the head compiles instead (`CompileStance`); a replacement that says nothing closes the head.
const code = (ce: ComputeEngine, head: string, ...operands: string[]): string | undefined =>
  compileTyped(ce, [head, ...operands], Object.fromEntries(operands.map((name) => [name, "real"])))?.code;

/** Why compiling `expression` fails, or undefined when it compiles. */
const failure = (ce: ComputeEngine, expression: unknown): string | undefined => {
  try {
    new JavaScriptTarget().compile(ce.box(expression as never));
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};

const inert = () => () => undefined;
const CLOSED = /replaced what it computes without saying how it compiles/;

test("a head that states nothing is closed on a fresh engine, with nothing extended before", () => {
  const ce = new ComputeEngine();
  wrapOperator(ce, ["Sin", 1], () => false, inert, 1);
  expect(failure(ce, ["Sin", "x"])).toMatch(CLOSED);
  expect(code(ce, "Sin", "x")).toBeUndefined();
  expect(code(ce, "Cos", "x")).toBe("Math.cos(_.x)");
});

test("a replaced evaluate on an extension is closed too, not left to compute-engine's shadow check", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, 1);
  expect(failure(ce, ["Sin", "x"])).toMatch(CLOSED);
});

test("a head that states 'builtin' keeps the target's lowering, after a signature or a flag extension", () => {
  const ce = new ComputeEngine();
  defineOverload(ce, "Sin", { package: "test", on: ["Interval"], written: true, evaluate: () => undefined });
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(code(ce, "Sin", "x")).toBe("Math.sin(_.x)");
  expect(compileExpression(ce.box(["Sin", "x"]))?.({ x: 0 })).toBe(0);
});

test("one unstated replacement closes the head, whatever else states 'builtin'", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  wrapOperator(ce, ["Sin", 1], () => false, inert, 1);
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(failure(ce, ["Sin", "x"])).toMatch(CLOSED);
});

test("a head with a widened signature compiles up to its native operand count", () => {
  const ce = new ComputeEngine();
  widenSignature(ce, "Erf", "(number, number?) -> number");
  wrapOperator(ce, ["Erf", 1], () => false, inert, { compile: { upTo: 1 } });
  expect(code(ce, "Erf", "x")).toContain("erf(");
  expect(failure(ce, ["Erf", "x", "y"])).toMatch(/Erf has no javascript lowering for 2 operands/);
});

test("a lowering of its own answers, and declines to the built-in", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, {
    arity: 1,
    compile: (args) => (JSON.stringify(args[0]?.json) === '"y"' ? "SIN_OF_Y" : undefined),
  });
  expect(code(ce, "Sin", "y")).toBe("SIN_OF_Y");
  expect(code(ce, "Sin", "x")).toBe("Math.sin(_.x)");
});

test("a guard throws for the operands it can't vouch for and declines otherwise", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  const guard = refusing((operands) => operands.some((op) => JSON.stringify(op.json) === '"y"'), "y is special");
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: guard });
  expect(failure(ce, ["Sin", "y"])).toMatch(/no javascript lowering: y is special/);
  expect(code(ce, "Sin", "x")).toBe("Math.sin(_.x)");
});

test("a handler attached in place states its own stance", () => {
  const ce = new ComputeEngine();
  extendHead(ce, "Sin", { broadcastable: true });
  const operator = (ce.lookupDefinition("Sin") as { operator: { evaluate?: unknown } }).operator;
  operator.evaluate = () => undefined;
  expect(failure(ce, ["Sin", "x"])).toMatch(/shadows the library operator/);
  declareCompile(ce, "Sin", "builtin");
  expect(code(ce, "Sin", "x")).toBe("Math.sin(_.x)");
});

test("an overload row with no carrier states how the head compiles", () => {
  const ce = new ComputeEngine();
  defineOverload(ce, "Sin", { package: "test", compile: "builtin", when: () => false, evaluate: () => undefined });
  extendHead(ce, "Sin", { broadcastable: true });
  wrapOperator(ce, ["Sin", 1], () => false, inert, { arity: 1, compile: "builtin" });
  expect(code(ce, "Sin", "x")).toBe("Math.sin(_.x)");
  const closed = new ComputeEngine();
  defineOverload(closed, "Sin", { package: "test", when: () => false, evaluate: () => undefined });
  expect(failure(closed, ["Sin", "x"])).toMatch(CLOSED);
});

test("compute-engine's own compile for a head survives a stance that restricts it", () => {
  const ce = new ComputeEngine();
  ce.declare("Twice", { signature: "(number) -> number", compile: () => "OWN_LOWERING" });
  expect(code(ce, "Twice", "x")).toBe("OWN_LOWERING");
  wrapOperator(ce, ["Twice", 1], () => false, inert, { arity: 1, compile: { upTo: 1 } });
  expect(code(ce, "Twice", "x")).toBe("OWN_LOWERING");
});
