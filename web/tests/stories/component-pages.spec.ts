// One test per story on a component's reference page: load the page, find the story's live
// render by its anchor, and check the custom element actually upgraded and drew something --
// not just that the page returned 200. Data-driven off stories-data.ts (packages/components/
// scripts/collect-stories.ts), so a new story or component picks up its own test for free.
//
// Run with: pnpm --filter @enumeratio/web run test:stories

import { collectComponents, wrapperName } from "@enumeratio/frontend/reflect";
import { expect, test } from "@playwright/test";
import { STORIES_DATA } from "../../../packages/components/src/stories-data.ts";

const srcDir = new URL("../../../packages/components/src/", import.meta.url).pathname;

// STORIES_DATA is keyed by the Vue/React wrapper name (`BarChart3D`); the page route is the
// custom-element tag (`notatio-bar-chart-3d`) -- the same rule ComponentPage.vue's `wrapper`
// computed applies the other way.
const tagByName = new Map(collectComponents(srcDir).map((c) => [wrapperName(c.tag), c.tag]));

for (const [name, stories] of Object.entries(STORIES_DATA)) {
  const tag = tagByName.get(name);

  test.describe(name, () => {
    for (const story of stories) {
      test(story.caption, async ({ page }) => {
        test.skip(tag === undefined, `no component tag maps to wrapper name "${name}"`);

        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (err) => consoleErrors.push(String(err)));

        await page.goto(`/reference/components/${tag}#story/${story.id}`);

        // An attribute selector, not `#story/<id>` -- the id itself contains a literal `/`
        // (Stories.vue, mirroring ReferencePage.vue's `example/<id>` anchors), which a CSS ID
        // selector would need escaping for.
        const card = page.locator(`[id="story/${story.id}"]`);
        await expect(card).toBeVisible();

        // The custom element itself upgraded (Lit's constructor replaces the HTMLElement
        // fallback), not just present as an unresolved tag in the DOM.
        const el = card.locator(tag!).first();
        await expect(el).toBeVisible();
        await expect.poll(() => el.evaluate((node, t) => node instanceof customElements.get(t)!, tag)).toBe(true);

        // BarChart3D (this migration's only component) renders an SVG into light DOM
        // (`createRenderRoot` returns `this`); a later component's test may check its own
        // shadow root or canvas instead.
        await expect(el.locator("svg")).toHaveCount(1);

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      });
    }
  });
}
