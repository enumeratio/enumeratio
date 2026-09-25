import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { portableTeX } from "@enumeratio/formats/tex";
import { entryFiles } from "@enumeratio/reference";
import { fromWolframTeX } from "@enumeratio/wolfram";
import { expect, test } from "vite-plus/test";
import { conventionalLatexDictionary } from "../src/conventional-latex.ts";
import { traditionalLatexOf } from "../src/traditional.ts";

// Our TeXForm beside Wolfram's, for every reference example the oracle ran through Wolfram
// (its `TeXForm` rides on the sidecar row). Not an assertion that they agree -- a record of
// where they do, so a change on either side shows up as a golden diff to review. Regenerate
// with `UPDATE_TEXFORM=1 vp test`; Wolfram's side refreshes with the oracle scan. Wolfram's TeX
// is recorded as it printed, and compared in notatio's spelling (`fromWolframTeX`).

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
});

const ours = (json: unknown): string =>
  portableTeX(traditionalLatexOf(ce, ce.box(json as never, { form: "raw" })));

/** Spacing, sizing and upright-text markup aside, the same TeX. */
const normal = (tex: string): string =>
  tex
    .replace(/\\(left|right|bigl|bigr|big|Big)(?![a-zA-Z])/g, "")
    .replace(/\\(operatorname|mathrm|text)\{([^{}]*)\}/g, "$2")
    .replace(/\\lbrace/g, "\\{")
    .replace(/\\rbrace/g, "\\}")
    .replace(/\\lbrack/g, "[")
    .replace(/\\rbrack/g, "]")
    .replace(/\\[,;:! ]/g, "")
    .replace(/\s+/g, "")
    .replace(/\{(\w)\}/g, "$1");

interface Row {
  readonly ours: { readonly input: string; readonly output: string };
  readonly wolfram: { readonly input: string; readonly output: string };
  readonly same: { readonly input: boolean; readonly output: boolean };
}

const rows: Record<string, Row> = {};
for (const { stem, entries } of entryFiles) {
  for (const entry of entries) {
    entry.examples.forEach((example, index) => {
      const wolfram = example.others?.wolfram?.tex;
      if (wolfram === undefined) return;
      const mine = { input: ours(example.expr), output: ours(example.expected) };
      rows[`${stem}/${entry.name}#${index + 1}`] = {
        ours: mine,
        wolfram,
        same: {
          input: normal(mine.input) === normal(fromWolframTeX(wolfram.input)),
          output: normal(mine.output) === normal(fromWolframTeX(wolfram.output)),
        },
      };
    });
  }
}

const GOLDEN = fileURLToPath(new URL("./texform-alignment.golden.json", import.meta.url));

test("our TeXForm beside Wolfram's, per example", () => {
  if (process.env.UPDATE_TEXFORM === "1") {
    writeFileSync(GOLDEN, `${JSON.stringify(rows, null, 2)}\n`);
    return;
  }
  expect(rows).toEqual(JSON.parse(readFileSync(GOLDEN, "utf8")));
});
