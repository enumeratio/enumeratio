import { readFileSync } from "node:fs";
import { createMarkdownRenderer } from "vitepress";
import { expect, test } from "vite-plus/test";
import { isMarkupTag, notatioMarkup, outOf, VUE_COMPONENTS } from "./notatio-markup.ts";

const md = await createMarkdownRenderer(import.meta.dirname, { config: notatioMarkup as never });
const render = (src: string): string => md.render(src, { relativePath: "test.md" });

test("markup in a sentence is shown inline, on lines of its own displayed", () => {
  expect(render("Choose: <Binomial>5 2</Binomial>.")).toContain(outOf(["Binomial", 5, 2], false));
  expect(render('<PolyLog s="2">\n  <Divide>1 2</Divide>\n</PolyLog>\n\nNext.')).toContain(
    outOf(["PolyLog", 2, ["Divide", 1, 2]], true),
  );
  expect(render('Read <ToExpression value="Sin(k * x)" /> as written.')).toContain(
    outOf(["Sin", ["Multiply", "k", "x"]], false),
  );
});

test("markup starting a line in a paragraph stays in the sentence", () => {
  expect(render("so,\n<Binomial>10 3</Binomial> and on")).toContain(`so,\n${outOf(["Binomial", 10, 3], false)} and on`);
});

test("code, components and plain HTML are left alone", () => {
  const html = render('`<Binomial>5 2</Binomial>` and <Symbol name="Binomial" />\n\n```\n<Plot>x</Plot>\n```');
  expect(html).not.toContain("notatio-out");
  expect(html).toContain('<Symbol name="Binomial" />');
  expect(isMarkupTag("Content")).toBe(false);
  expect(isMarkupTag("Stats.Mean")).toBe(true);
  expect(isMarkupTag("enumeratio.PolygonalNumber")).toBe(true);
  expect(isMarkupTag("my.element")).toBe(false);
});

test("markup that doesn't read fails, naming the page", () => {
  expect(() => render("<Binomial>n+1 2</Binomial>")).toThrow(/^test\.md: markup: "n\+1" isn't an atom/);
});

test("every component the theme registers is one markup leaves alone", () => {
  const theme = readFileSync(new URL("theme/index.mts", import.meta.url), "utf8");
  const registered = [...theme.matchAll(/app\.component\("(\w+)"/g)].map((m) => m[1]);
  expect(registered.length).toBeGreaterThan(0);
  expect(registered.filter((name) => !VUE_COMPONENTS.has(name!))).toEqual([]);
});
