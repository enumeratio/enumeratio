import { describe, expect, test } from "vite-plus/test";
import { orderImplementations } from "../src/index.ts";

describe("orderImplementations", () => {
  test("writes examples, forms, systems and fields in one order, whatever order they came in", () => {
    const scanned = {
      b: { sympy: { out: "2", in: "f(2)" }, wolfram: { in: "F[2]", out: "2" }, epsil: { in: "F(2)" } },
      gone: { mpmath: { in: "f(9)", note: "kept" } },
      a: { zeta: { in: "?" }, fullform: { in: "F[1]" }, tex: { in: "F(1)" } },
    };
    const ordered = orderImplementations(scanned, ["a", "b"], ["wolfram", "sympy"]);
    expect(JSON.stringify(ordered)).toEqual(
      JSON.stringify({
        a: { tex: { in: "F(1)" }, fullform: { in: "F[1]" }, zeta: { in: "?" } },
        b: { epsil: { in: "F(2)" }, wolfram: { in: "F[2]", out: "2" }, sympy: { in: "f(2)", out: "2" } },
        gone: { mpmath: { in: "f(9)", note: "kept" } },
      }),
    );
  });
});
