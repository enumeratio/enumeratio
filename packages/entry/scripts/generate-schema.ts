// Write the JSON Schema for the two records (design/examples-as-data.md §4) to
// `schema/*.schema.json`. `tests/schema.test.ts` fails if a committed file drifts from this;
// run this script to bring it back in sync.
//
//   vp node packages/entry/scripts/generate-schema.ts

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HEAD_IMPLEMENTATIONS_SCHEMA, REFERENCE_ENTRY_SCHEMA } from "../src/schema.ts";

const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));

for (const [file, schema] of [
  ["reference-entry.schema.json", REFERENCE_ENTRY_SCHEMA],
  ["head-implementations.schema.json", HEAD_IMPLEMENTATIONS_SCHEMA],
] as const) {
  writeFileSync(schemaDir + file, JSON.stringify(schema, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
