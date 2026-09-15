import { expect, test } from "vite-plus/test";
import { classifyInput, parseIntList, resolveForm, resolveSyntax } from "../src/index.ts";

test("Epsil is the default syntax (no auto-detection)", () => {
  expect(classifyInput("Binomial(10, 3)")).toEqual({ syntax: "epsil", body: "Binomial(10, 3)" });
  expect(classifyInput("x + 1")).toEqual({ syntax: "epsil", body: "x + 1" });
  // a bare bracket / Head[…] line is NOT special-cased any more
  expect(classifyInput("[3, 1, 2]").syntax).toBe("epsil");
  expect(classifyInput("Binomial[10, 3]").syntax).toBe("epsil");
});

test("a syntax pragma selects the syntax for that line", () => {
  expect(classifyInput(":wolfram Binomial[10, 3]")).toEqual({
    syntax: "wolfram",
    body: "Binomial[10, 3]",
  });
  expect(classifyInput(":mathjson [1, 2]")).toEqual({ syntax: "mathjson", body: "[1, 2]" });
  expect(classifyInput(":latex x^2")).toEqual({ syntax: "latex", body: "x^2" });
  expect(classifyInput(":epsil 2 + 2")).toEqual({ syntax: "epsil", body: "2 + 2" });
});

test("short aliases still resolve", () => {
  expect(classifyInput(":wl Plus[1, 2]").syntax).toBe("wolfram");
  expect(classifyInput(":mj [1, 2]").syntax).toBe("mathjson");
  expect(classifyInput(":tex x^2").syntax).toBe("latex");
});

test("the fallback overrides the default for bare input", () => {
  expect(classifyInput("Foo bar", "latex").syntax).toBe("latex");
});

test("resolveForm / resolveSyntax accept full names, aliases, and unique prefixes", () => {
  expect(resolveForm("wolfram")).toBe("wolfram");
  expect(resolveForm("wolf")).toBe("wolfram");
  expect(resolveForm("python")).toBe("numpy"); // alias
  expect(resolveForm("w")).toBeUndefined(); // ambiguous: wolfram / wgsl
  expect(resolveSyntax("w")).toBe("wolfram");
  expect(resolveSyntax("zzz")).toBeUndefined();
});

test("parseIntList accepts JSON, spaces, and commas", () => {
  expect(parseIntList("[3, 1, 2]")).toEqual([3, 1, 2]);
  expect(parseIntList("3 1 2")).toEqual([3, 1, 2]);
  expect(parseIntList("3,1,2")).toEqual([3, 1, 2]);
});
