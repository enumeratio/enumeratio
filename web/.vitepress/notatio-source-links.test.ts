import { createMarkdownRenderer } from "vitepress";
import { expect, test } from "vite-plus/test";
import { notatioSourceLinks, sourceLinkHref } from "./notatio-source-links.ts";

const heads = new Set(["Binomial", "Sin", "Plot"]);
const href = (source: string): string | undefined => sourceLinkHref(source, heads);

test("an expression of a documented head links to its page, source in the query", () => {
  expect(href("Binomial(5, 2)")).toBe(`/reference/symbol/Binomial?epsil=${encodeURIComponent("Binomial(5, 2)")}#live`);
  expect(href("2 * Sin(x)")).toContain("/reference/symbol/Sin?epsil=");
  expect(href("Plot(Sin(x), (x, 0, 10))")).toContain("/reference/symbol/Plot?");
});

test("shell commands, paths, unknown heads, placeholders and prose are not linked", () => {
  for (const code of [
    "pnpm install --frozen-lockfile",
    "vp run build",
    "packages/analytic/src/Binomial(x).ts",
    "./Binomial(x)",
    "Frobnicate(5)",
    "Binomial(…)",
    "Binomial(n, ",
    "Binomial",
    "",
  ]) {
    expect(href(code), code).toBeUndefined();
  }
});

test("code spans and epsil fences are linked, other code is left alone", async () => {
  const md = await createMarkdownRenderer(import.meta.dirname, { config: notatioSourceLinks as never });
  const html = md.render(
    "Try `Sin(x)` and `ls -la` and [`Sin(x)`](/elsewhere).\n\n```epsil\nSin(x)\n```\n\n```bash\nSin(x)\n```\n",
    { relativePath: "t.md" },
  );
  expect(html.match(/class="source-link"/g)).toHaveLength(1);
  expect(html.match(/try it/g)).toHaveLength(1);
});

test("head is the first documented call; the source round-trips through the query", () => {
  expect(href("Frobnicate(Binomial(5, 2))")).toContain("/reference/symbol/Binomial?");
  const source = "Plot(Sin(x), (x, 0, 10))";
  const out = href(source)!;
  expect(out.endsWith("#live")).toBe(true);
  const query = out.slice(out.indexOf("?") + 1, out.lastIndexOf("#"));
  expect(new URLSearchParams(query).get("epsil")).toBe(source);
});
