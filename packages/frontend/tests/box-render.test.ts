// The web's boxes are their own tags (`row-box`), and a TableViewBox is the one that behaves.

import { form, fraction, grid, interpretation, pane, row, superscript, tableView, tag, text } from "@enumeratio/boxes";
import { expect, test } from "vite-plus/test";
import { markupOf } from "../src/box-leaf.ts";
import { renderBox } from "../src/box-render.ts";
import { renderingOf } from "../src/symbols.ts";
import { rowSourceExpression } from "../src/row-spec.ts";

test("layout boxes are drawn as their own tags", () => {
  const drawn = renderBox(row([text("a"), grid([[text("b"), text("c")]]), pane(text("d"), { Scrollbars: true })]));
  expect(drawn.tag).toBe("row-box");
  expect(drawn.children?.map((c) => c.tag)).toEqual(["span", "grid-box", "pane-box"]);
});

test("a TableViewBox is its element: the source as written, the headers known, the size fixed", () => {
  const source = rowSourceExpression({ collection: { str: "SymmetricGroup(25)" } as never, columns: ["Descents"] });
  const drawn = renderBox(
    tableView(source, {
      ImageSize: [480, 320],
      TableViewBoxHeaders: ["element", "Descents"],
      ScrollPosition: 40,
      MaxItems: 20,
      Pagination: true,
    }),
  );
  expect(drawn.tag).toBe("table-view-box");
  expect(JSON.parse(drawn.attributes.source!)).toEqual(source);
  expect(drawn.attributes).toMatchObject({
    headers: '["element","Descents"]',
    "scroll-position": "40",
    "max-items": "20",
    pagination: "",
    style: "width: 480px; height: 320px",
  });
});

test("a math run is one leaf: its TeX for the host to typeset, its text until then", () => {
  const drawn = renderBox(row(["x", "+", fraction("1", "2")]));
  expect(drawn).toMatchObject({
    tag: "form-box",
    attributes: { "data-form": "TraditionalForm" },
    tex: "x+\\frac{1}{2}",
  });
  expect(markupOf(drawn, (tex) => `<span>${tex}</span>`)).toBe(
    '<form-box data-form="TraditionalForm"><span>x+\\frac{1}{2}</span></form-box>',
  );
  expect(markupOf(drawn)).toMatch(/^<form-box data-form="TraditionalForm">.+<\/form-box>$/);
});

test("a TeX form is a leaf holding its TeX as written", () => {
  expect(renderBox(form("\\frac{a}{b}", "TeXForm"))).toMatchObject({
    tag: "form-box",
    attributes: { "data-form": "TeXForm" },
    tex: "\\frac{a}{b}",
  });
});

test("a grid of formulas is a grid-box of leaves, not one array", () => {
  const drawn = renderBox(
    tag(
      grid([
        [fraction("1", "2"), "3"],
        [superscript("x", "2"), text("note")],
      ]),
      "Grid",
    ),
  );
  expect(drawn.tag).toBe("grid-box");
  expect(drawn.children?.map((c) => c.tag)).toEqual(["form-box", "form-box", "form-box", "span"]);
  expect(drawn.children?.map((c) => c.tex)).toEqual(["\\frac{1}{2}", "3", "x^2", undefined]);
});

test("a fenced matrix in a row stays one leaf", () => {
  const matrix = row([
    "(",
    grid([
      ["1", "0"],
      ["0", "1"],
    ]),
    ")",
  ]);
  expect(renderBox(matrix)).toMatchObject({ tag: "form-box", tex: "\\begin{pmatrix}1&0\\\\0&1\\end{pmatrix}" });
});

test("an interpretation keeps its expression on the leaf", () => {
  const drawn = renderBox(interpretation(row(["a", "+", "b"]), ["Add", "a", "b"] as never));
  expect(drawn.tex).toMatch(/^\\htmlData\{expr=[\w-]+\}\{a\+b\}$/);
});

test("a collection table's collection keeps the name it is declared under, so a reader can retype it", () => {
  const drawn = renderingOf(["CollectionTable", "NonNegativeIntegers"] as never);
  expect(drawn?.attributes.expr).toBe("NonNegativeIntegers");
});

test("markup never writes a name that could break out of its tag, whatever the option key", () => {
  const evil = 'x" onmouseover="alert(1)';
  const markup = markupOf({
    tag: "graphics-box",
    attributes: { value: "a", [evil]: "1", "data-ok": "b" },
    children: [{ tag: 'b onclick="alert(1)"', attributes: {}, text: "t" }],
  });
  expect(markup).toBe('<graphics-box value="a" data-ok="b"><span>t</span></graphics-box>');
});
