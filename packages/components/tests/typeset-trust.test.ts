// The page's typesetter trusts exactly one thing: the `data-expr` an interpretation carries.
// Real KaTeX, since what it does with a refused command is the point.

import { exprOfData, katexStrict, toLatex, trustExpression } from "@enumeratio/boxes/render";
import katex from "katex";
import { expect, test } from "vite-plus/test";

const render = (tex: string): string =>
  katex.renderToString(tex, { throwOnError: false, output: "html", strict: katexStrict(), trust: trustExpression });

test("an interpretation's expression is typeset onto the node and reads back", () => {
  const expr = ["Add", "a", "b"];
  const tex = toLatex(["InterpretationBox", ["RowBox", ["a", "+", "b"]], expr] as never, { data: true });
  const value = /data-expr="([^"]+)"/.exec(render(tex))?.[1];
  expect(value).toBeDefined();
  expect(exprOfData(value!)).toEqual(expr);
});

test("user TeX gets no other command or attribute through", () => {
  expect(render("\\href{https://example.com}{y}")).not.toContain("href=");
  expect(render("\\htmlClass{a}{b}")).not.toContain('class="a"');
  expect(render("\\htmlData{foo=bar}{x}")).not.toContain("data-foo");
  expect(render("\\htmlData{expr=AAAA,onclick=x}{x}")).not.toContain("data-expr");
  expect(render("\\htmlData{expr=not base64!}{x}")).not.toContain("data-expr");
});
