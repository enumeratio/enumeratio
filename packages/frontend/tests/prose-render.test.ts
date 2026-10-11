// Prose boxes through the web renderer: TextData, TextCell and ButtonBox as the HTML they are, the
// holes of a StringTemplate as the page's to fill, a tooltip and a pane selector as their tags.

import {
  type Box,
  button,
  form,
  paneSelector,
  dynamic,
  row,
  slot,
  textCell,
  textData,
  tooltip,
  text,
} from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { markupOf } from "../src/box-leaf.ts";
import { renderBox } from "../src/box-render.ts";
import { renderingOf } from "../src/symbols.ts";

const markup = (box: Box): string => markupOf(renderBox(box), (tex) => `<tex>${tex}</tex>`);

test("TextData is a span of its words, formulas and links", () => {
  expect(
    markup(textData(["See ", button("docs", { ButtonData: "https://example.org" }), " and ", form("x^2", "TeXForm")])),
  ).toBe(
    '<span><span>See </span><a href="https://example.org"><span>docs</span></a><span> and </span><form-box data-form="TeXForm"><tex>x^2</tex></form-box></span>',
  );
});

test("a link to a head names it for the host to find", () => {
  expect(markup(button("Subsets", { ButtonData: "Subsets", BaseStyle: "Link" }))).toBe(
    '<a data-link="Subsets"><span>Subsets</span></a>',
  );
});

test("a setter keeps its anchor; the button-box around it names the variable and the value", () => {
  const drawn = markup(button(text("snap"), { ButtonFunction: 'Set(_k, "on")' }));
  expect(drawn).toBe(
    '<button-box set="k" to="&quot;on&quot;"><a href="#" class="notatio-setter"><span>snap</span></a></button-box>',
  );
});

test("a TextCell is the block its style names", () => {
  expect(markup(textCell(textData(["Hello"]), "Text"))).toBe(
    '<p data-cell-style="Text"><span><span>Hello</span></span></p>',
  );
  expect(markup(textCell("Intro", "Section"))).toBe('<h2 data-cell-style="Section"><span>Intro</span></h2>');
  expect(markup(textCell("f(x)", "Program", { Language: "epsil" }))).toBe(
    '<pre><code class="language-epsil">f(x)</code></pre>',
  );
});

test("consecutive item cells are one list; a deeper item nests, a numbered one starts an ol", () => {
  const cells = row([
    textCell("a", "Text"),
    textCell("one", "Item"),
    textCell("two", "Item"),
    textCell("deep", "Subitem"),
    textCell("three", "Item"),
    textCell("first", "ItemNumbered"),
    textCell("b", "Text"),
  ]);
  expect(markup(cells)).toBe(
    '<row-box><p data-cell-style="Text"><span>a</span></p>' +
      '<ul data-cell-list=""><li data-cell-style="Item"><span>one</span></li>' +
      '<li data-cell-style="Item"><span>two</span>' +
      '<ul data-cell-list=""><li data-cell-style="Subitem"><span>deep</span></li></ul></li>' +
      '<li data-cell-style="Item"><span>three</span></li></ul>' +
      '<ol data-cell-list=""><li data-cell-style="ItemNumbered"><span>first</span></li></ol>' +
      '<p data-cell-style="Text"><span>b</span></p></row-box>',
  );
  // Alone, an item is still a list.
  expect(markup(textCell("x", "Item"))).toBe(
    '<ul data-cell-list=""><li data-cell-style="Item"><span>x</span></li></ul>',
  );
});

test("a list that opens below level 0 sits in a placeholder item with no bullet", () => {
  expect(markup(row([textCell("deep", "Subsubitem")]))).toBe(
    '<row-box><ul data-cell-list=""><li data-placeholder="">' +
      '<ul data-cell-list=""><li data-placeholder="">' +
      '<ul data-cell-list=""><li data-cell-style="Subsubitem"><span>deep</span></li></ul>' +
      "</li></ul></li></ul></row-box>",
  );
});

test("a hole nothing filled is the page's: a variable by name, a readout by its expression", () => {
  expect(markup(textData(["n = ", slot("n", { random: "" }), ", ", ["TemplateExpression", "N(_n^2)"] as never]))).toBe(
    '<span><span>n = </span><template-slot name="n" random=""></template-slot><span>, </span><dynamic-box value="N(_n^2)"></dynamic-box></span>',
  );
});

test("a hole named like an inherited property is still a hole", () => {
  expect(renderBox(slot("constructor")).tag).toBe("template-slot");
});

test("TeX with a variable in it is live: fragments and slots as JSON", () => {
  const drawn = renderBox(form(row(["\\sqrt{", slot("d"), "}"]), "TeXForm"));
  expect(drawn).toMatchObject({ tag: "template-slot" });
  expect(JSON.parse(drawn.attributes.parts!)).toEqual(["\\sqrt{", { slot: "d" }, "}"]);
});

test("a tooltip is a tab stop whose tip is its text", () => {
  expect(markup(tooltip(text("x"), text("the unknown")))).toBe(
    '<tooltip-box data-tip="the unknown" tabindex="0"><span>x</span></tooltip-box>',
  );
});

test("a link target the page may not follow draws as its label", () => {
  expect(markup(button("x", { ButtonData: "javascript:alert(1)" }))).toBe("<span>x</span>");
  expect(markup(button("x", { ButtonData: " JaVa\tScript:alert(1)" }))).toBe("<span>x</span>");
  expect(markup(button("x", { ButtonData: "/docs/a" }))).toBe('<a href="/docs/a"><span>x</span></a>');
  expect(markup(button("x", { ButtonData: "#top" }))).toBe('<a href="#top"><span>x</span></a>');
});

test("a pane selector is its selector and its panes under their keys", () => {
  expect(
    markup(
      paneSelector(
        [
          ["True", text("big")],
          ["False", text("small")],
        ],
        dynamic(["Greater", "_n", 5] as never),
      ),
    ),
  ).toBe(
    '<pane-selector-box selector="_n > 5"><span data-pane="True"><span>big</span></span><span data-pane="False"><span>small</span></span></pane-selector-box>',
  );
});

test("a bare name as the selector reads that variable", () => {
  const drawn = renderBox(paneSelector([["low", text("small")]], dynamic("level" as never)));
  expect(drawn.attributes.selector).toBe("_level");
});

test("a StringTemplate is its text with the holes in it, the head riding on it", () => {
  const expr = ["StringTemplate", "'Primes of $\\sqrt{_d}$, d = {_d}, {N(_d^2)}.'"];
  expect(markupOf(renderingOf(expr as never)!, (tex) => `<tex>${tex}</tex>`)).toBe(
    '<span data-head="StringTemplate"><span>Primes of </span><template-slot parts="[&quot;\\\\sqrt{&quot;,{&quot;slot&quot;:&quot;d&quot;},&quot;}&quot;]"></template-slot><span>, d = </span><template-slot name="d"></template-slot><span>, </span><dynamic-box value="N(_d^2)"></dynamic-box><span>.</span></span>',
  );
});
