// The markdown pass that marks a page's cells and plots for the build: each gets a placeholder,
// and what it needs is recorded, the starting values of a Manipulate around it included.

import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { type MarkupSpec, preloads, prerenderMarkup, specsFile } from "./prerender-markup.ts";

type Rule = (state: { tokens: { type: string; content: string }[]; env: Record<string, unknown> }) => void;

function run(html: string): { html: string; specs: MarkupSpec[] } {
  let rule: Rule | undefined;
  prerenderMarkup({ core: { ruler: { push: (_name: string, fn: Rule) => void (rule = fn) } } } as never);
  const tokens = [{ type: "html_block", content: html }];
  const relativePath = "prerender-markup-test.md";
  rule!({ tokens, env: { relativePath } });
  return { html: tokens[0]!.content, specs: JSON.parse(readFileSync(specsFile(relativePath), "utf8")) as MarkupSpec[] };
}

test("a cell gets a placeholder, and a plot in a v-pre Manipulate a plain one, with its starting values", () => {
  const { html, specs } = run(
    [
      '<notatio-cell value="BellNumber(6)" />',
      '<notatio-manipulate v-pre params="{a, 1, 5}">',
      '<notatio-plot value="Sin(_a * x)" domain="-3,3" />',
      "</notatio-manipulate>",
      '<notatio-cell value="x" prerender="false" />',
    ].join("\n"),
  );
  expect(html).toContain('<notatio-cell value="BellNumber(6)"><NotatioPrerendered :at="0" /></notatio-cell>');
  expect(html).toContain(
    '<notatio-plot value="Sin(_a * x)" domain="-3,3"><span class="notatio-prerendered" data-prerender="1"></span></notatio-plot>',
  );
  expect(html).toContain('<notatio-cell value="x" prerender="false" />');
  expect(specs.map((s) => [s.tag, s.attributes["value"], s.manipulate])).toEqual([
    ["notatio-cell", "BellNumber(6)", []],
    ["notatio-plot", "Sin(_a * x)", ["{a, 1, 5}"]],
  ]);
});

test("a page preloads the chunks its prerendered tags load", () => {
  const tags = new Set(["notatio-cell"]);
  expect(preloads("/assets/chunks/notatio-out.AbC12.js", tags)).toBe(true);
  expect(preloads("/assets/chunks/notatio-plot.AbC12.js", tags)).toBe(false);
});
