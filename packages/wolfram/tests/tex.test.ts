import { expect, test } from "vite-plus/test";
import { fromWolframTeX, toWolframTeX } from "../src/tex.ts";

test("a bare \\log is Wolfram's natural log", () => {
  expect(fromWolframTeX("\\frac{\\pi }{2}-i \\log \\left(2+\\sqrt{3}\\right)")).toBe(
    "\\frac{\\pi }{2}-i \\ln \\left(2+\\sqrt{3}\\right)",
  );
  expect(fromWolframTeX("0.5 \\log ^2(2)")).toBe("0.5 \\ln ^2(2)");
  expect(toWolframTeX("\\ln(2)+\\ln(3)")).toBe("\\log(2)+\\log(3)");
});

test("a based \\log, and words that start with log, are left alone", () => {
  expect(fromWolframTeX("\\log _2(8)=\\log _{10}(100)")).toBe("\\log _2(8)=\\log _{10}(100)");
  expect(fromWolframTeX("\\text{log$\\Gamma $}(5)")).toBe("\\text{log$\\Gamma $}(5)");
  expect(toWolframTeX("\\log_{2}(8)+\\lnot p")).toBe("\\log_{2}(8)+\\lnot p");
});
