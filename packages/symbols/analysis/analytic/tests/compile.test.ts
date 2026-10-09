// unstable: a bare ComputeEngine with only the analytic declarations, to see what still compiles
import { compileExpression, compileTyped } from "@enumeratio/engine/compiled";
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// analytic extends and wraps library heads, which compute-engine would otherwise refuse to lower by
// name ("a user definition shadows the library operator"). A head compiles as the target's built-in
// lowering when everything analytic adds to it is an identity or fires on operands compiled code never
// holds, and fails to compile where analytic changes what a number gives.

const ce = new ComputeEngine();
declareAnalytic(ce);

const compiled = (head: string, operands: number): string | undefined => {
  const names = ["x", "y", "z"].slice(0, operands);
  return compileTyped(ce, [head, ...names], Object.fromEntries(names.map((name) => [name, "real"])))?.code;
};

test("Sin(x) compiles to Math.sin once analytic is declared, through compileTyped and compileExpression", () => {
  expect(compiled("Sin", 1)).toBe("Math.sin(_.x)");
  const run = compileExpression(ce.box(["Add", ["Sin", "x"], ["Cos", "x"]]));
  expect(run?.({ x: 0 })).toBe(1);
});

test("the elementary and special functions analytic wraps keep their built-in lowering", () => {
  for (const head of ["Cos", "Tan", "Ln", "Gamma", "Erf", "Digamma", "Zeta", "Floor", "Sign"]) {
    expect(compiled(head, 1), head).toMatch(/\(/);
  }
  expect(compiled("Mod", 2)).toMatch(/\(/);
});

test("a head analytic widens compiles only up to its native operand count", () => {
  expect(compiled("Gamma", 2)).toMatch(/gamma\(/);
  expect(compiled("Gamma", 3)).toBeUndefined();
  expect(compiled("Zeta", 2)).toBeUndefined();
});

test("a head whose value analytic changes on real operands fails closed", () => {
  // BetaRegularized(x, a, b) is a number for x > 1, where the built-in lowering gives NaN.
  expect(compiled("BetaRegularized", 3)).toBeUndefined();
});
