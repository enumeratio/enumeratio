import { expect, test } from "vite-plus/test";
import { Repl } from "../src/index.ts";
import { summariesLoaded } from "../src/information.ts";

const repl = new Repl({ color: false });

test("?Name: the kind, summary, signature and page", async () => {
  await summariesLoaded;
  const { text } = repl.eval("?MajorIndex");
  expect(text).toContain("MajorIndex  function");
  expect(text).toContain("The major index of");
  expect(text).toContain("(list | permutation) -> integer");
  expect(text).toContain("https://enumeratio.dev/reference/symbol/MajorIndex");
  expect(text).not.toContain("overloads");
});

test("??Name adds every overload, parameters, packages and FindStat ids", () => {
  const { text } = repl.eval("??Floor");
  expect(text).toMatch(/structures +\(any, any\?\) -> any +\(replaces combinatorics\)/);
  expect(text).toContain("params     x");
  expect(repl.eval("??MajorIndex").text).toContain("St000004 on Permutation");
});

test("?Pattern* lists the heads it matches; an unknown name says so", () => {
  expect(repl.eval("?Zeta*").text).toBe("  Zeta");
  expect(repl.eval("?Fooble").text).toContain("nothing is known");
  // Not an input line: nothing is numbered.
  expect(repl.lineNo).toBe(1);
});
