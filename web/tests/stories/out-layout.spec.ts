// `<notatio-out>` on a layout, through the real route: the docs page mounts the element, which asks
// the page's kernel (or engine), draws through the box renderer and typesets with KaTeX.
//
// Run with: pnpm --filter @enumeratio/web run test:stories

import { expect, test } from "@playwright/test";

test("an evaluated Grid of closed formulas is a grid-box of typeset leaves", async ({ page }) => {
  await page.goto("/docs/components/out");
  const out = page.locator('notatio-out[value^="Grid([[1/2"]');
  const grid = out.locator("grid-box");
  await expect(grid).toBeVisible();
  // One leaf per cell, each typeset, and no readout among them.
  await expect(grid.locator(":scope > form-box")).toHaveCount(6);
  await expect(grid.locator(":scope > form-box .katex")).toHaveCount(6);
  await expect(grid.locator("dynamic-box")).toHaveCount(0);
});

test("a Grid in a cell is drawn as the same grid-box once the cell takes over", async ({ page }) => {
  await page.goto("/docs/components/out");
  const grid = page.locator('notatio-cell[value^="Grid([[1/2, Sqrt(2)], [Pi"]').locator("notatio-out grid-box");
  await expect(grid).toBeVisible();
  await expect(grid.locator(":scope > form-box .katex")).toHaveCount(4);
});

test("a cell with a free symbol stays a readout", async ({ page }) => {
  await page.goto("/docs/components/out");
  const grid = page.locator('notatio-out[value^="Grid([[k"]').locator("grid-box");
  await expect(grid).toBeVisible();
  await expect(grid.locator("dynamic-box").first()).toBeVisible();
});
