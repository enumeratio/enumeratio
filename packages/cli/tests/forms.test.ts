import { expect, test } from "vite-plus/test";
import { renderForm, Session } from "../src/index.ts";

const session = new Session();
const box = (mathjson: unknown) => session.ce.box(mathjson as Parameters<Session["ce"]["box"]>[0]);

test("notatio/tex/mathjson/wolfram forms", () => {
  const e = box(["Add", "x", 1]);
  expect(renderForm(e, "notatio")).toContain("x");
  expect(renderForm(e, "tex")).toContain("x");
  expect(JSON.parse(renderForm(e, "mathjson"))).toEqual(["Add", "x", 1]);
  expect(renderForm(box(["Binomial", 10, 3]), "wolfram")).toBe("Binomial[10, 3]");
});

test("code targets compile a numeric expression", () => {
  const e = box(["Add", ["Power", "x", 2], 1]);
  expect(renderForm(e, "js")).toMatch(/x/);
  expect(renderForm(e, "numpy")).toMatch(/x/);
});

test("evaluate records history and honours % references", () => {
  const s = new Session();
  const a = s.evaluate(":wl Plus[2, 3]");
  expect(a.n).toBe(1);
  expect(a.expr.toString()).toBe("5");
  const b = s.evaluate(":wl Times[%, 4]"); // % = last result = 5
  expect(b.expr.toString()).toBe("20");
});

test("let binds a variable that later input resolves", () => {
  const s = new Session();
  s.assign("a", ":wl 7");
  expect(s.vars.get("a")?.toString()).toBe("7");
  expect(s.evaluate(":wl Plus[a, 1]").expr.toString()).toBe("8");
});

test("Wolfram full form reaches the enumeratio combinatorial heads", () => {
  const s = new Session();
  // Inversions of the permutation 3 1 2 -> 2.
  expect(s.evaluate(":wl Inversions[List[3, 1, 2]]").expr.toString()).toBe("2");
});

test("Epsil is the default input; $…$ islands parse LaTeX", () => {
  const s = new Session();
  expect(s.evaluate("Binomial(10, 3)").expr.toString()).toBe("120");
  expect(s.evaluate("Inversions([3, 1, 2])").expr.toString()).toBe("2");
  expect(s.evaluate("$\\binom{10}{3}$").expr.toString()).toBe("120");
  // bare LaTeX is rejected in Epsil — use $…$ or :latex
  expect(() => s.evaluate("\\binom{10}{3}")).toThrow();
});

test("notatio renders Epsil", () => {
  expect(renderForm(box(["Add", ["Power", "x", 2], 1]), "notatio")).toBe("x ^ 2 + 1");
  expect(renderForm(box(["Binomial", 10, 3]), "notatio")).toBe("Binomial(10, 3)");
});
