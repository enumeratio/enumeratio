// The build's kernel compiles a plot's expression, as the page's kernel does: a plot with no
// compiled `code` is drawn only after the browser samples it, so nothing is prerendered.

import { expect, test } from "vite-plus/test";
import type { CompiledPlot } from "@enumeratio/frontend/plot-compile";
import { pageKernel } from "./prerender-markup.ts";

test("the prerender kernel returns compiled code for Sin(x)", async () => {
  const kernel = await pageKernel();
  const answer = await kernel.evaluate({
    source: { text: "Sin(x)", format: "epsil" },
    compile: { target: "javascript", each: true },
  });
  const plot = answer.compiled as CompiledPlot;
  expect(answer.ok).toBe(true);
  expect(plot.items[0]?.code).toContain("Math.sin");
});
