// The build's answers reach a reference page's HTML: each example typeset into its
// placeholders, and none of that HTML left in the page's data.

import { expect, test } from "vite-plus/test";
import type { ReferenceEntry } from "@enumeratio/reference";
import { fillPrerendered, prerenderExamples } from "./prerender.ts";

const entry = {
  name: "PrerenderTestHead",
  examples: [
    { id: "sum", expr: ["Add", 1, 2], expected: 3 },
    { id: "dice", expr: ["Random"], expected: 0.5, volatile: ["random"] },
    { id: "bad", expr: ["Sin", "ComplexInfinity"], expected: ["Error", ["ErrorCode", "'incompatible-type'"], 1] },
  ],
} as unknown as ReferenceEntry;

test("each example is answered from its record, typeset into the page, and kept out of its data", async () => {
  const answers = await prerenderExamples(entry);
  expect(answers[0]?.value).toBe(3);
  expect(answers[0]?.input).toEqual({ text: '["Add",1,2]', format: "mathjson" });
  expect(answers[0]?.html).toBeUndefined();
  // A volatile value is the browser's to compute.
  expect(answers[1]).toBeUndefined();
  // An error answer is the cell's to show, with its message.
  expect(answers[2]).toBeUndefined();
  const page = '<span data-prerender="0:out" data-v-1></span><span data-prerender="1:out"></span>';
  const filled = fillPrerendered(page, entry.name);
  expect(filled).toMatch(
    /^<span data-prerender="0:out" data-v-1><form-box data-form="TeXForm"><span class="katex">.*<\/span><\/form-box><\/span><span data-prerender="1:out"><\/span>$/,
  );
});

test("a closed Grid is written as the grid of leaves the Out draws, and a live one as the standard leaf", async () => {
  const closed = ["Grid", ["List", ["List", ["Rational", 1, 2], ["Sqrt", 2]], ["List", "Pi", ["Power", 2, 10]]]];
  const live = ["Grid", ["List", ["List", "k", ["Power", "k", 2]]]];
  const grid = {
    name: "PrerenderGridHead",
    examples: [
      { id: "closed", expr: closed, expected: closed },
      { id: "live", expr: live, expected: live },
    ],
  } as unknown as ReferenceEntry;
  await prerenderExamples(grid);
  const filled = fillPrerendered('<span data-prerender="0:out"></span><span data-prerender="1:out"></span>', grid.name);
  const [first, second] = filled.split("</span><span data-prerender");
  expect(first).toMatch(/^<span data-prerender="0:out"><grid-box data-head="Grid"/);
  expect(first?.match(/<form-box data-form="TraditionalForm"><span class="katex">/g)).toHaveLength(4);
  expect(second).toMatch(/^="1:out"><form-box data-form="TeXForm">/);
});
