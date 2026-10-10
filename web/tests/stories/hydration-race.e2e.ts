// Prerendered cells must survive a slow hydration. The elements are defined only after the
// prerendered placeholders hydrate (theme/hydration.ts); one that upgraded first would have its
// rendered children removed by Vue's hydration and stay blank, with no error.
//
// Needs the built site: pnpm --filter @enumeratio/web run build && run test:hydration

import { expect, test } from "@playwright/test";
import { PENDING_SELECTOR } from "../../.vitepress/theme/hydration.ts";

const PAGE = "/docs/components/cell";
// The page's own chunk, and the async `Story` component it hydrates through.
const CHUNKS = {
  page: /\/docs_components_cell\.md\.[^/]*\.lean\.js$/,
  story: /\/Story\.[^/]*\.js$/,
};
// Only the errors a hydration or lit failure would raise; resource and service-worker noise is not ours.
const RELEVANT = /\blit\b|hydrat|insertBefore/i;

for (const ms of [0, 1000]) {
  test(`every prerendered cell renders when hydration is delayed ${ms} ms`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on(
      "console",
      (message) => message.type() === "error" && RELEVANT.test(message.text()) && errors.push(message.text()),
    );
    const delayed = { page: 0, story: 0 };
    if (ms > 0)
      for (const [name, pattern] of Object.entries(CHUNKS) as [keyof typeof CHUNKS, RegExp][])
        await page.route(pattern, async (route) => {
          delayed[name]++;
          await new Promise((resolve) => setTimeout(resolve, ms));
          await route.continue();
        });
    await page.goto(PAGE);
    // Both done: the elements defined and every placeholder hydrated -- the damage, if any, comes
    // when Vue hydrates a placeholder beside a cell that has already rendered.
    await page.waitForFunction(
      (pending) => customElements.get("notatio-cell") !== undefined && document.querySelector(pending) === null,
      PENDING_SELECTOR,
    );
    // A chunk regex that no longer matches would turn this into a test of nothing.
    if (ms > 0)
      for (const [name, count] of Object.entries(delayed))
        expect(count, `${name} chunk was delayed`).toBeGreaterThan(0);
    const cells = page.locator("notatio-cell");
    expect(await cells.count()).toBeGreaterThan(0);
    // The cell's own root, back after the elements are defined...
    for (const cell of await cells.all()) await expect(cell.locator(":scope > .notatio-cell")).toHaveCount(1);
    // ...and its lit part still attached to the cell, not orphaned by Vue removing the children.
    // A part we can't find (lit's internals renamed) is unknown, not orphaned.
    const orphaned = await cells.evaluateAll(
      (els) =>
        els.filter((el) => {
          const part = (el as unknown as { _$litPart$?: { _$AA?: Node; _$startNode?: Node } })._$litPart$;
          const start = part?._$AA ?? part?._$startNode;
          return start !== undefined && start.parentNode !== el;
        }).length,
    );
    expect(orphaned).toBe(0);
    expect(errors).toEqual([]);
  });
}
