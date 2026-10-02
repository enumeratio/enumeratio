import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseEpsil } from "@cortex-js/compute-engine/epsil";
import { describe, expect, test } from "vite-plus/test";
import { applyPatch, assignFunctionDefinition } from "../src/index.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  applyPatch(ce, assignFunctionDefinition);
  return ce;
};

const epsil = (ce: ComputeEngine, src: string) => ce.box(parseEpsil(src)[0] as never);

describe("Assign with an application on the left", () => {
  test("defines the function, as the LaTeX route does", () => {
    const fromEpsil = engine();
    epsil(fromEpsil, "f(x) := x^2 + a").evaluate();
    const fromLatex = engine();
    fromLatex.parse("f(x)\\coloneq x^2+a").evaluate();
    for (const arg of [3, "y", ["Add", "y", 1]]) {
      const call = ["f", arg] as never;
      expect(fromEpsil.box(call).evaluate().json).toEqual(fromLatex.box(call).evaluate().json);
    }
    expect(fromEpsil.box(["f", 3] as never).evaluate().json).toEqual(["Add", "a", 9]);
  });

  test("both readers give the same expression", () => {
    const ce = engine();
    expect(epsil(ce, "f(x, y) := x - y").json).toEqual(ce.parse("f(x,y)\\coloneq x-y").json);
  });

  test("several parameters", () => {
    const ce = engine();
    epsil(ce, "g(x, y) := x - y").evaluate();
    expect(ce.box(["g", 5, 2] as never).evaluate().json).toBe(3);
  });

  test("the definition is evaluated lazily, like the LaTeX one", () => {
    const ce = engine();
    epsil(ce, "h(x) := x + b").evaluate();
    ce.assign("b", 10);
    expect(ce.box(["h", 1] as never).evaluate().json).toBe(11);
  });

  test("a symbol on the left is untouched", () => {
    const ce = engine();
    epsil(ce, "k := 4").evaluate();
    expect(ce.box("k").evaluate().json).toBe(4);
  });

  test("a left side that is not distinct symbols still does not define anything", () => {
    const ce = engine();
    epsil(ce, "m(x, x) := x").evaluate();
    epsil(ce, "n(1) := 2").evaluate();
    expect(ce.box(["m", 1, 2] as never).evaluate().operator).toBe("m");
    expect(ce.box(["n", 1] as never).evaluate().operator).toBe("n");
  });
});
