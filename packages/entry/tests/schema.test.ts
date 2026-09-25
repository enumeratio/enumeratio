// The committed JSON Schema files must match what schema.ts generates right now -- otherwise
// an editor's completion silently drifts from the actual record shape. Regenerate with
// `node --experimental-strip-types scripts/generate-schema.ts` (or `vp node`, once available)
// after changing types.ts or schema.ts.

import { readFileSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { HEAD_IMPLEMENTATIONS_SCHEMA, REFERENCE_ENTRY_SCHEMA } from "../src/schema.ts";

const schemaFile = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../schema/${name}`, import.meta.url), "utf8"));

test("reference-entry.schema.json is up to date with schema.ts", () => {
  expect(schemaFile("reference-entry.schema.json")).toEqual(REFERENCE_ENTRY_SCHEMA);
});

test("head-implementations.schema.json is up to date with schema.ts", () => {
  expect(schemaFile("head-implementations.schema.json")).toEqual(HEAD_IMPLEMENTATIONS_SCHEMA);
});
