import { expect, test } from "vite-plus/test";
import {
  type Box,
  fromMathJson,
  readInlineMarkdown,
  readMarkdown,
  texToAscii,
  texToText,
  toHtml,
  toMarkdown,
  toMathJson,
  toAscii,
  toText,
} from "../src/index.ts";

const tex = (latex: string, display: boolean): string => `<k${display ? " display" : ""}>${latex}</k>`;
const html = (md: string): string => toHtml(readMarkdown(md), { tex, link: (h) => `/reference/symbol/${h}` });
const inline = (md: string): readonly Box[] => (readInlineMarkdown(md) as readonly ["TextData", Box[]])[1];

test("`$…$` is TeX held as written, `${}` included", () => {
  expect(inline("the ${}_pF_q(a;b;z)$ function")).toEqual([
    "the ",
    ["FormBox", "{}_pF_q(a;b;z)", "TeXForm"],
    " function",
  ]);
  expect(inline("$2+2$")).toEqual([["FormBox", "2+2", "TeXForm"]]);
});

test("a bare `$` is a dollar sign", () => {
  expect(inline("costs $5 or $6")).toEqual(["costs $5 or $6"]);
  expect(inline("`$Aborted` and $ x $")).toEqual([["StyleBox", "$Aborted", { BaseStyle: "InlineCode" }], " and $ x $"]);
  expect(inline("\\$x\\$")).toEqual(["$x$"]);
  // From records: Wolfram's system symbols beside real math, and prices.
  expect(inline("aborts to $Aborted past $t$ seconds.")).toEqual([
    "aborts to $Aborted past ",
    ["FormBox", "t", "TeXForm"],
    " seconds.",
  ]);
  expect(inline("consult $Assumptions (Simplify)")).toEqual(["consult $Assumptions (Simplify)"]);
  expect(inline("a $42.50 charge")).toEqual(["a $42.50 charge"]);
});

test("holes, in text and inside TeX", () => {
  expect(inline("k is ${k}, twice ${2 k}")).toEqual([
    "k is ",
    ["TemplateSlot", "k"],
    ", twice ",
    ["TemplateExpression", "2 k"],
  ]);
  expect(inline("$x^{${k}}$")).toEqual([["FormBox", ["RowBox", ["x^{", ["TemplateSlot", "k"], "}"]], "TeXForm"]]);
  expect(inline("`${k}`")).toEqual([["StyleBox", "${k}", { BaseStyle: "InlineCode" }]]);
});

test("emphasis, links and `[[Head]]`", () => {
  expect(inline("*a* **b** a_1 [[Zeta]] [DLMF](https://dlmf.nist.gov/25)")).toEqual([
    ["StyleBox", "a", { FontSlant: "Italic" }],
    " ",
    ["StyleBox", "b", { FontWeight: "Bold" }],
    " a_1 ",
    ["ButtonBox", "Zeta", { BaseStyle: "Link", ButtonData: "Zeta" }],
    " ",
    ["ButtonBox", "DLMF", { BaseStyle: "Hyperlink", ButtonData: "https://dlmf.nist.gov/25" }],
  ]);
});

test("blocks read as cells, and write back", () => {
  const md = [
    "## Series",
    "",
    "Defined by",
    "a series.",
    "",
    "- one",
    "  - nested",
    "- two",
    "",
    "1. first",
    "",
    "$$",
    "\\sum_k z^k",
    "$$",
    "",
    "```ts",
    "const a = ${b};",
    "```",
  ].join("\n");
  const cells = readMarkdown(md);
  expect(cells.map((c) => (c as readonly [string, Box, string])[2])).toEqual([
    "Section",
    "Text",
    "Item",
    "Subitem",
    "Item",
    "ItemNumbered",
    "DisplayFormula",
    "Program",
  ]);
  expect(readMarkdown(toMarkdown(cells))).toEqual(cells);
  expect(html(md)).toBe(
    "<h2>Series</h2><p>Defined by a series.</p>" +
      "<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul><ol><li>first</li></ol>" +
      "<k display>\\sum_k z^k</k>" +
      '<pre><code class="language-ts">const a = ${b};</code></pre>',
  );
});

test("HTML: escaped text, links, unfilled and filled holes", () => {
  expect(html("x < y & [[Zeta]]")).toBe('<p>x &lt; y &amp; <a href="/reference/symbol/Zeta">Zeta</a></p>');
  expect(toHtml(readInlineMarkdown("${k} and $x^${k}$"), { tex })).toBe("${k} and <k>x^\\text{\\$\\{k\\}}</k>");
  const hole = (_: unknown, where: "text" | "tex"): string => (where === "tex" ? "3" : "<b>3</b>");
  expect(toHtml(readInlineMarkdown("${k} and $x^${k}$"), { tex, hole })).toBe("<b>3</b> and <k>x^3</k>");
});

test("text: TeX read cheaply, as Unicode or AsciiMath's ASCII", () => {
  const prose = readInlineMarkdown("the ${}_2F_1(a,b;c;z)$ function");
  expect(toText(prose)).toBe("the ₂F₁(a,b;c;z) function");
  expect(toAscii(prose)).toBe("the _2F_1(a,b;c;z) function");
  const both = (tex: string): [string, string] => [texToText(tex), texToAscii(tex)];
  expect(both("2^{53}")).toEqual(["2⁵³", "2^(53)"]);
  expect(both("\\frac{\\pi^2}{6}")).toEqual(["π²/6", "(pi^2)/6"]);
  expect(both("\\zeta(s) = \\sum_{n\\ge1} n^{-s}")).toEqual(["ζ(s) = ∑_(n≥1) n^(−s)", "zeta(s) = sum_(n>=1) n^(-s)"]);
  expect(both("x \\in \\mathbb{R}")).toEqual(["x ∈ ℝ", "x in RR"]);
  expect(both("\\alpha\\beta \\le \\sqrt{2}\\infty")).toEqual(["αβ ≤ √2∞", "alpha beta <= sqrt(2)oo"]);
});

test("prose boxes survive MathJSON", () => {
  const cells = readMarkdown("A *b* $c^{${d}}$ [[E]]\n\n```js\nf\n```");
  for (const cell of cells) expect(fromMathJson(toMathJson(cell))).toEqual(cell);
});
