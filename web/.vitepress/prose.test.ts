import { type Box, readInlineMarkdown, texSource } from "@enumeratio/boxes";
import { referenceData } from "@enumeratio/reference/node";
import katex from "katex";
import { expect, test } from "vite-plus/test";

/** Every piece of prose a record carries, with where it came from. */
function* prose(): Generator<[where: string, text: string]> {
  for (const { head, entry } of referenceData().heads) {
    if (entry.summary) yield [`${head} summary`, entry.summary];
    for (const s of entry.signatures ?? []) if (s.description) yield [`${head} ${s.call}`, s.description];
    for (const [i, d] of (entry.details ?? []).entries()) yield [`${head} details[${i}]`, d];
    for (const b of entry.bindings ?? []) {
      if (b.note) yield [`${head} binding note`, b.note];
      if (b.produces) yield [`${head} binding produces`, b.produces];
    }
    for (const e of entry.examples ?? []) {
      if (e.caption) yield [`${head}/${e.id} caption`, e.caption];
      for (const note of Object.values(e.divergence ?? {})) yield [`${head}/${e.id} divergence`, note];
      for (const [system, run] of Object.entries(e.others ?? {})) {
        if (run.note) yield [`${head}/${e.id} ${system} note`, run.note];
      }
    }
  }
}

function* formulas(box: Box): Generator<string> {
  if (typeof box === "string") return;
  if (box[0] === "FormBox" && box[2] === "TeXForm") yield texSource(box[1]);
  else if (box[0] === "TextData") for (const b of box[1]) yield* formulas(b);
  else if (box[0] === "StyleBox" || box[0] === "ButtonBox") yield* formulas(box[1]);
}

test("every formula in the records' prose typesets in KaTeX", { timeout: 60_000 }, () => {
  const failed: string[] = [];
  for (const [where, text] of prose()) {
    for (const latex of formulas(readInlineMarkdown(text))) {
      try {
        katex.renderToString(latex, { throwOnError: true, strict: false });
      } catch (e) {
        failed.push(`${where}: $${latex}$ -- ${(e as Error).message.split("\n")[0]}`);
      }
    }
  }
  expect(failed).toEqual([]);
});
