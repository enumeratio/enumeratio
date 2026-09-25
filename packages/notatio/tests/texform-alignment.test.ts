import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine, LatexSyntax } from "@cortex-js/compute-engine";
import { portableTeX } from "@enumeratio/formats/tex";
import { entryFiles as filesOf } from "@enumeratio/reference/node";
import { fromWolframTeX, HEADS } from "@enumeratio/wolfram";
import { expect, test } from "vite-plus/test";
import { conventionalLatexDictionary } from "../src/conventional-latex.ts";
import { traditionalLatexOf } from "../src/traditional.ts";

const entryFiles = filesOf();

// Our TeXForm beside Wolfram's, for every reference example the oracle ran through Wolfram
// (its `TeXForm` rides on the sidecar row). Not an assertion that they agree -- a record of
// where they do, so a change on either side shows up as a golden diff to review. Regenerate
// with `UPDATE_TEXFORM=1 vp test`; Wolfram's side refreshes with the oracle scan. Wolfram's TeX
// is recorded as it printed, and compared in notatio's spelling (`fromWolframTeX`).

const ce = new ComputeEngine({
  latexSyntax: new LatexSyntax({ dictionary: conventionalLatexDictionary() as never[] }),
});

const ours = (json: unknown): string => portableTeX(traditionalLatexOf(ce, ce.box(json as never, { form: "raw" })));

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

/** Wolfram's TeXForm shows a real to six significant digits, and a whole one as `115.`; ours
 *  shows every digit, a repeating tail as `\overline{…}`. Both are compared as Wolfram shows. */
const shown = (tex: string): string =>
  tex
    .replace(/(\d+\.\d*)\\overline\{?(\d+)\}?/g, (_, head: string, cycle: string) =>
      head.concat(cycle.repeat(Math.ceil(20 / cycle.length))),
    )
    .replace(/\d+\.\d+/g, (x) => {
      const rounded = Number(x).toPrecision(6);
      return rounded.includes("e") ? x : rounded.replace(/\.?0+$/, "");
    })
    .replace(/(\d)\.(?!\d)/g, "$1");

/** How we write each head we have no notation for -- the TeX before `(x)` -- so Wolfram's
 *  `\text{Round}[x]` reads as our `\mathrm{round}(x)`. */
const heads = new Map(
  [...new Set([...Object.keys(HEADS), ...entryFiles.flatMap((f) => f.entries.map((e) => e.name))])]
    .map((name) => [name, /^(\\(?:mathrm|operatorname)\{[^{}]+\})\(x\)$/.exec(ours([name, "x"]))?.[1]])
    .filter((entry): entry is [string, string] => entry[1] !== undefined),
);

const same = (mine: string, wolfram: string): boolean =>
  shown(normal(mine)) === shown(normal(fromWolframTeX(wolfram, { heads })));

interface Row {
  readonly ours: { readonly input: string; readonly output: string };
  readonly wolfram: { readonly input: string; readonly output: string };
  readonly same: { readonly input: boolean; readonly output: boolean };
}

const rows: Record<string, Row> = {};
for (const { entries } of entryFiles) {
  for (const entry of entries) {
    entry.examples.forEach((example) => {
      const wolfram = example.others?.wolfram?.tex;
      if (wolfram === undefined) return;
      const mine = { input: ours(example.expr), output: ours(example.expected) };
      rows[`${entry.name}/${example.id}`] = {
        ours: mine,
        wolfram,
        same: {
          input: same(mine.input, wolfram.input),
          output: same(mine.output, wolfram.output),
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
