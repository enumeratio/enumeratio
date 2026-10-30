// The glyph kind of every carrier and of every collection head over one, into
// generated/head-glyphs.json, read from the records' `glyph:` field (a collection's `carrier:` names
// its carrier). The runtime loads no manifest, so table-state.ts imports this table.
// `build` runs it; never committed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { glyphTable } from "./glyph-table.ts";

const TABLE = fileURLToPath(new URL("../generated/head-glyphs.json", import.meta.url));

const { heads, issues } = loadReferenceData(PACKAGES);
if (issues.length > 0) throw new Error(JSON.stringify(issues, null, 2));

const table = glyphTable(heads.map((h) => h.entry));
mkdirSync(dirname(TABLE), { recursive: true });
writeFileSync(TABLE, JSON.stringify(table));
console.log(`glyph kinds for ${Object.keys(table).length} heads -> ${TABLE}`);
