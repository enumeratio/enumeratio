// A head's details live in index.md's body as a markdown list, and read back as written.

import { expect, test } from "vite-plus/test";
import { decodeHead, headFiles } from "../src/record.ts";
import type { ReferenceEntry } from "../src/types.ts";

const entry = {
  name: "Mod",
  domain: "Numbers",
  signature: "Mod(a, b)",
  summary: "Remainder.",
  details: [
    "Plain, with $x_1$ and *emphasis*.",
    "- starts like a list item",
    "1. and like a numbered one",
    "two\nlines",
  ],
  examples: [],
} as unknown as ReferenceEntry;

test("details round-trip through index.md's body, exactly as written", async () => {
  const files = await headFiles({ entry, body: "" });
  const index = files.get("index.md")!;
  expect(index).not.toMatch(/^details:/m);
  expect(index).toContain("\n- Plain, with $x_1$ and *emphasis*.\n");
  expect(decodeHead(files).entry).toEqual(entry);
});
