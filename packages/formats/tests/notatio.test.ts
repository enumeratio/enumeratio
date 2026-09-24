import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { collectWildcards, parseNotatio, serializeNotatio } from "../src/notatio.ts";

const ce = new ComputeEngine();
const parseLatex = (tex: string) => ce.parse(tex).json;

test("a plain expression is valid notatio", () => {
  const { errors, wildcards } = parseNotatio("Sin(x) + 1");
  expect(errors).toEqual([]);
  expect(wildcards).toEqual([]);
});

test("named wildcards are collected as slots", () => {
  const { errors, wildcards, json } = parseNotatio("_A * Sin(_w * x + _p)");
  expect(errors).toEqual([]);
  expect(wildcards).toEqual(["_A", "_w", "_p"]);
  expect(collectWildcards(json)).toEqual(["_A", "_w", "_p"]);
});

test("filling slots re-serializes as notatio and round-trips", () => {
  const { json } = parseNotatio("_A * Sin(_w * x + _p)");
  const filled = serializeNotatio(ce.box(json).subs({ _A: 2, _w: 3, _p: 1 }).json);
  // The plot variable `x` survives; the serialized result re-parses cleanly.
  expect(parseNotatio(filled).errors).toEqual([]);
  // A numeric slot body evaluates to a number.
  const n = parseNotatio("_n * 20");
  expect(serializeNotatio(ce.box(n.json).subs({ _n: 4 }).evaluate().json)).toBe("80");
});

test("statements and effects are rejected", () => {
  expect(parseNotatio("x := 2").errors.length).toBeGreaterThan(0);
  expect(parseNotatio("if x > 0 then 1 else 2").errors.length).toBeGreaterThan(0);
});

test("$…$ LaTeX islands are allowed with a parseLatex hook", () => {
  expect(parseNotatio("$\\frac{1}{x}$", { parseLatex }).errors).toEqual([]);
});

test("juxtaposition of two symbols is an error (explicit * required)", () => {
  expect(parseNotatio("A Sin(x)").errors.length).toBeGreaterThan(0);
  expect(parseNotatio("A * Sin(x)").errors).toEqual([]);
});

test("a Cell's input may be one := binding; nowhere else", () => {
  expect(parseNotatio("DynamicModule([Cell(a := 5), Cell(a^2)])").errors).toEqual([]);
  expect(parseNotatio("Cell(b := (c := 1))").errors.length).toBeGreaterThan(0);
  expect(parseNotatio("f(a := 1)").errors.length).toBeGreaterThan(0);
});
