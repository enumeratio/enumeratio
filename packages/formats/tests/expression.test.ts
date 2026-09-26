import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { collectWildcards, parseExpression, serializeExpression } from "../src/expression.ts";

const ce = new ComputeEngine();
const parseLatex = (tex: string) => ce.parse(tex).json;

test("a plain expression is valid", () => {
  const { errors, wildcards } = parseExpression("Sin(x) + 1");
  expect(errors).toEqual([]);
  expect(wildcards).toEqual([]);
});

test("named wildcards are collected as slots", () => {
  const { errors, wildcards, json } = parseExpression("_A * Sin(_w * x + _p)");
  expect(errors).toEqual([]);
  expect(wildcards).toEqual(["_A", "_w", "_p"]);
  expect(collectWildcards(json)).toEqual(["_A", "_w", "_p"]);
});

test("filling slots re-serializes as Epsil and round-trips", () => {
  const { json } = parseExpression("_A * Sin(_w * x + _p)");
  const filled = serializeExpression(ce.box(json).subs({ _A: 2, _w: 3, _p: 1 }).json);
  // The plot variable `x` survives; the serialized result re-parses cleanly.
  expect(parseExpression(filled).errors).toEqual([]);
  // A numeric slot body evaluates to a number.
  const n = parseExpression("_n * 20");
  expect(serializeExpression(ce.box(n.json).subs({ _n: 4 }).evaluate().json)).toBe("80");
});

test("statements and effects are rejected", () => {
  expect(parseExpression("x := 2").errors.length).toBeGreaterThan(0);
  expect(parseExpression("if x > 0 then 1 else 2").errors.length).toBeGreaterThan(0);
});

test("$…$ LaTeX islands are allowed with a parseLatex hook", () => {
  expect(parseExpression("$\\frac{1}{x}$", { parseLatex }).errors).toEqual([]);
});

test("juxtaposition of two symbols is an error (explicit * required)", () => {
  expect(parseExpression("A Sin(x)").errors.length).toBeGreaterThan(0);
  expect(parseExpression("A * Sin(x)").errors).toEqual([]);
});

test("a Cell's input may be one := binding; nowhere else", () => {
  expect(parseExpression("DynamicModule([Cell(a := 5), Cell(a^2)])").errors).toEqual([]);
  expect(parseExpression("Cell(b := (c := 1))").errors.length).toBeGreaterThan(0);
  expect(parseExpression("f(a := 1)").errors.length).toBeGreaterThan(0);
});

test("a decimal reads as the digits it was typed with", () => {
  // compute-engine's own `parseEpsil` reads `0.3` as 0.30000000000000004.
  for (const [src, value] of [
    ["0.3", 0.3],
    ["-0.3", -0.3],
    ["5.56", 5.56],
    ["0.000_001", 0.000001],
    ["1.414_2", 1.4142],
    ["10e-17", 1e-16],
  ] as const) {
    expect(ce.box(parseExpression(src).json).re, src).toBe(value);
  }
});

test("a diagnostic carries the span it is about", () => {
  const { errors, diagnostics } = parseExpression("10^-16");
  expect(errors.length).toBeGreaterThan(0);
  expect(diagnostics[0]).toEqual({ message: errors[0], range: [2, 4] });
  expect(parseExpression("f := 1").diagnostics[0]).toEqual({
    message: "Assign is not allowed in an expression",
    range: [0, 6],
  });
});
