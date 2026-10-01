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
  ],
} as unknown as ReferenceEntry;

test("each example is answered from its record, typeset into the page, and kept out of its data", async () => {
  const answers = await prerenderExamples(entry);
  expect(answers[0]?.value).toBe(3);
  expect(answers[0]?.input).toEqual({ text: '["Add",1,2]', format: "mathjson" });
  expect(answers[0]?.html).toBeUndefined();
  // A volatile value is the browser's to compute.
  expect(answers[1]).toBeUndefined();
  const page = '<span data-prerender="0:out" data-v-1></span><span data-prerender="1:out"></span>';
  const filled = fillPrerendered(page, entry.name);
  expect(filled).toMatch(
    /^<span data-prerender="0:out" data-v-1><span class="katex">.*<\/span><span data-prerender="1:out"><\/span>$/,
  );
});
