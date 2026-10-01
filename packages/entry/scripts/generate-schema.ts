// Write the JSON Schema for the records and a library symbol's mappings (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §4) to
// `schema/*.schema.json` (uncommitted; `build` runs this).
//
//   vp node packages/entry/scripts/generate-schema.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  COMPONENT_STORIES_SCHEMA,
  HEAD_IMPLEMENTATIONS_SCHEMA,
  REFERENCE_ENTRY_SCHEMA,
  REFERENCE_EXAMPLES_SCHEMA,
  SYMBOL_MAPPINGS_SCHEMA,
} from "../src/schema.ts";

const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));

mkdirSync(schemaDir, { recursive: true });

for (const [file, schema] of [
  ["reference-entry.schema.json", REFERENCE_ENTRY_SCHEMA],
  ["reference-examples.schema.json", REFERENCE_EXAMPLES_SCHEMA],
  ["head-implementations.schema.json", HEAD_IMPLEMENTATIONS_SCHEMA],
  ["component-stories.schema.json", COMPONENT_STORIES_SCHEMA],
  ["symbol-mappings.schema.json", SYMBOL_MAPPINGS_SCHEMA],
] as const) {
  writeFileSync(schemaDir + file, JSON.stringify(schema, null, 2) + "\n");
  console.log(`wrote ${file}`);
}
