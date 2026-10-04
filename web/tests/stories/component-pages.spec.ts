// One test per story on a component's reference page: load the page, find the story's live
// render by its anchor, and check the custom element actually upgraded and drew something --
// not just that the page returned 200. Data-driven off stories-data.ts (packages/components/
// scripts/collect-stories.ts), so a new story or component picks up its own test for free.
//
// Run with: pnpm --filter @enumeratio/web run test:stories

import { fileURLToPath } from "node:url";
import type { Locator } from "@playwright/test";
import { STORIES_DATA } from "@enumeratio/components/stories-data";
import { collectComponents, headOfTag } from "@enumeratio/frontend/reflect";
import { expect, test } from "@playwright/test";

// The elements' sources, beside the package's manifest (they are what `collectComponents` reads).
const srcDir = fileURLToPath(new URL("./src/", import.meta.resolve("@enumeratio/components/package.json")));

// STORIES_DATA is keyed by the Vue/React wrapper name (`BarChart3D`); the page route is the
// custom-element tag (`notatio-bar-chart-3d`) -- the same rule ComponentPage.vue's `wrapper`
// computed applies the other way.
const tagByName = new Map(collectComponents(srcDir).map((c) => [headOfTag(c.tag), c.tag]));

// What "drew something" means, per tag -- most of these elements paint plain SVG into light
// DOM (`createRenderRoot` returns `this`); `notatio-collection-table` draws a data table
// instead (zero, one or many per-row glyph SVGs, depending on the story's `glyph`), so its
// check is its own -- an actual DATA row, not just any `tbody tr` (the "no rows" / "scanning…"
// placeholder is a `tr` too), and no `.nct-error` (a count or parse the table couldn't
// resolve). `td.nct-elt` is the element column, present only on a real data row -- unlike a
// bare `tbody tr`, which the "no rows" / "scanning…" placeholder row satisfies too.
// `notatio-complex-plot` is WebGPU-only, painting into a `<canvas>` rather than SVG, and
// reports its own "needs WebGPU" status in light DOM when no adapter is available -- a real
// condition in a headless/sandboxed runner, not a bug, so that case is *skipped* (with a
// reason) rather than failed. A tag with no entry here falls back to "at least one <svg>".
const RENDER_CHECKS: Readonly<Record<string, (el: Locator) => Promise<void>>> = {
  "notatio-collection-table": async (el) => {
    await expect(el.locator("table.nct-table tbody td.nct-elt").first()).toBeVisible();
    await expect(el.locator(".nct-error")).toHaveCount(0);
  },
  "notatio-complex-plot": async (el) => {
    const status = el.locator(".notatio-complex-plot-status");
    const canvas = el.locator("canvas");
    // `#init()` (notatio-complex-plot.ts) settles one way or the other -- a status
    // paragraph (no WebGPU adapter) or an actually-painted frame -- give it time before
    // deciding which.
    await expect(async () => {
      const drew = await canvasHasContent(canvas);
      expect(drew || (await status.count()) > 0).toBe(true);
    }).toPass();
    test.skip((await status.count()) > 0, "WebGPU unavailable in this browser -- see notatio-complex-plot-status");
    await expect(canvas).toBeVisible();
    expect(await canvasHasContent(canvas)).toBe(true);
  },
};

/** A canvas has painted something if it differs from a same-size blank one. */
function canvasHasContent(canvas: Locator): Promise<boolean> {
  return canvas.evaluate((c: HTMLCanvasElement) => {
    const blank = document.createElement("canvas");
    blank.width = c.width;
    blank.height = c.height;
    return c.toDataURL() !== blank.toDataURL();
  });
}

async function assertDrew(el: Locator, tag: string): Promise<void> {
  const check = RENDER_CHECKS[tag];
  if (check) {
    await check(el);
    return;
  }
  await expect(async () => expect(await el.locator("svg").count()).toBeGreaterThan(0)).toPass();
}

/** A story's live render, as a fingerprint that changes when the render does -- the SVG's
 * own markup, a canvas's pixels (as a data URL), or (a fallback for anything else) its
 * whole markup. Used to prove a slider move actually reached the driven component, not
 * just its own attribute. */
function fingerprintOf(target: Locator): Promise<string> {
  return target.evaluate((node) => {
    const svg = node.querySelector("svg");
    if (svg) return svg.outerHTML;
    const canvas = node.querySelector("canvas");
    if (canvas) return (canvas as HTMLCanvasElement).toDataURL();
    return node.outerHTML;
  });
}

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

        await page.goto(`/reference/component/${name}#story/${story.id}`);

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

        await assertDrew(el, tag!);

        expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      });
    }
  });
}

// A `Manipulate(...)` story additionally proves its slider actually drives the wrapped
// component live -- not just that the initial render drew something (the loop above), but
// that moving the control's own native `<input type=range>` (dispatching a real `input`
// event, exactly what a reader's drag would fire) changes the driven element's render. Every
// `<notatio-manipulate>` holds its controls in a `.notatio-manip-host` div and the original
// slotted content as its other light-DOM child (manipulate-ui.ts, notatio-manipulate.ts) --
// that child is what gets fingerprinted, before and after.
for (const [name, stories] of Object.entries(STORIES_DATA)) {
  const tag = tagByName.get(name);
  const manipulateStories = stories.filter((s) => Array.isArray(s.expr) && s.expr[0] === "Manipulate");
  if (manipulateStories.length === 0) continue;

  test.describe(`${name} (Manipulate)`, () => {
    for (const story of manipulateStories) {
      test(`${story.caption} -- the slider drives the render`, async ({ page }) => {
        test.skip(tag === undefined, `no component tag maps to wrapper name "${name}"`);

        await page.goto(`/reference/component/${name}#story/${story.id}`);
        const card = page.locator(`[id="story/${story.id}"]`);
        const manipulate = card.locator("notatio-manipulate").first();
        await expect(manipulate).toBeVisible();
        await expect
          .poll(() => manipulate.evaluate((n) => n instanceof customElements.get("notatio-manipulate")!))
          .toBe(true);

        const driven = manipulate.locator("> *:not(.notatio-manip-host)").first();
        await expect(driven).toBeVisible();

        // A discrete-choice control (a setter bar, not a slider) has no range input to
        // move -- skip rather than fail; its own "drew something" is already covered above.
        const slider = manipulate.locator(".notatio-manip-host input[type=range]").first();
        test.skip((await slider.count()) === 0, "no slider control on this Manipulate (a discrete choice, say)");

        // Let the first render (and, for a ComplexPlot child, its WebGPU device request)
        // settle before taking the "before" fingerprint.
        await expect(async () => expect((await fingerprintOf(driven)).length).toBeGreaterThan(0)).toPass();
        const webGpuUnavailable = (await driven.locator(".notatio-complex-plot-status").count()) > 0;
        test.skip(webGpuUnavailable, "WebGPU unavailable in this browser -- nothing to compare");

        const before = await fingerprintOf(driven);

        // Move by an irrational-ish fraction of the range rather than to an endpoint: a
        // control whose own range spans a period (`{t, 0, 6.283}`, a phase) would otherwise
        // risk landing back on a numerically near-identical value. Snapped to the
        // control's own step, so an integer-stepped parameter (an order, a count) stays on
        // a value its own head actually accepts.
        await slider.evaluate((input: HTMLInputElement) => {
          const min = Number(input.min);
          const max = Number(input.max);
          const span = max - min;
          const step = Number(input.step) || 0;
          let next = min + ((Number(input.value) - min + span * 0.37) % span);
          if (step > 0) next = min + Math.round((next - min) / step) * step;
          input.value = String(next);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        await expect(async () => expect(await fingerprintOf(driven)).not.toBe(before)).toPass();
      });
    }
  });
}
