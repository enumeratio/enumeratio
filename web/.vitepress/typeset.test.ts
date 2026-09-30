// Every formula written in the site's markdown pages, and every example's own TeX (as written and as evaluated, in StandardForm and TraditionalForm)
// typesets in KaTeX once `portableTeX` has rewritten compute-engine's MathLive-only commands:
// the reference page's cells draw them that way.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDollar } from "@enumeratio/boxes/render";
import { portableTeX } from "@enumeratio/formats/tex";
import { referenceData } from "@enumeratio/reference/node";
import katex from "katex";
import { expect, test } from "vite-plus/test";
import { repoRoot, workspacePackages } from "./data/repo-docs.ts";

test("every example's TeX typesets in KaTeX", { timeout: 60_000 }, () => {
  const failed: string[] = [];
  let typeset = 0;
  for (const { head, entry, implementations } of referenceData().heads) {
    // A row in triage isn't on the page, so its TeX isn't typeset there.
    const triage = new Set(entry.examples.filter((e) => e.role === "triage").map((e) => e.id));
    for (const [id, forms] of Object.entries(implementations ?? {})) {
      if (triage.has(id)) continue;
      for (const system of ["tex", "traditional"] as const) {
        const form = forms[system];
        for (const latex of [form?.in, form?.out]) {
          if (!latex) continue;
          typeset++;
          try {
            katex.renderToString(portableTeX(latex), { throwOnError: true, strict: false });
          } catch (e) {
            failed.push(`${head}/${id} ${system}: ${latex} -- ${(e as Error).message.split("\n")[0]}`);
          }
        }
      }
    }
  }
  expect(typeset).toBeGreaterThan(10_000);
  expect(failed).toEqual([]);
});

const WEB = fileURLToPath(new URL("..", import.meta.url));

/** The site's hand-written markdown pages (not the generated reference ones). */
function* webPages(dir = WEB): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "public") continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* webPages(path);
    else if (entry.name.endsWith(".md")) yield path;
  }
}

/** Those, and the package docs the site serves under /docs. */
function* pages(): Generator<string> {
  yield* webPages();
  for (const pkg of workspacePackages()) {
    if (pkg.readme) yield pkg.readme;
    for (const page of pkg.pages) yield join(repoRoot, page.file);
  }
}

/** A page's `$…$` and `$$…$$` formulas, outside code: what notatio-math.ts typesets. */
function* pageFormulas(markdown: string): Generator<[latex: string, display: boolean]> {
  const text = markdown.replace(/^(`{3,}|~{3,})[^]*?^\1/gm, "").replace(/(`+)[^`]*?\1/g, "");
  for (const m of text.matchAll(/^\s*\$\$([^]*?)\$\$/gm)) yield [m[1]!.trim(), true];
  for (const line of text.replace(/^\s*\$\$[^]*?\$\$/gm, "").split("\n")) {
    for (let i = line.indexOf("$"); i >= 0; i = line.indexOf("$", i + 1)) {
      const end = closeDollar(line, i);
      if (end < 0) continue;
      yield [line.slice(i + 1, end), false];
      i = end;
    }
  }
}

test("every formula in the site's markdown typesets in KaTeX", () => {
  const failed: string[] = [];
  let typeset = 0;
  for (const path of pages()) {
    for (const [latex, display] of pageFormulas(readFileSync(path, "utf8"))) {
      typeset++;
      try {
        katex.renderToString(latex, { displayMode: display, throwOnError: true, strict: false });
      } catch (e) {
        failed.push(`${path.slice(repoRoot.length + 1)}: $${latex}$ -- ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }
  expect(typeset).toBeGreaterThan(500);
  expect(failed).toEqual([]);
});
