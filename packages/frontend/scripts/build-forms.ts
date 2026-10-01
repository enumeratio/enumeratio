// Build every reference example's own forms (forms.ts) into generated/forms.json, keyed by
// `<package>/<Head>`, then example id: `{ epsil: { in, out, back?, backOut? }, tex, … }`. The
// records keep only the pinned ones; this is the whole table, for the site and the tools.
// `build` runs it; never committed.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { headForms, ownForms } from "./forms.ts";

const FORMS_TABLE = fileURLToPath(new URL("../generated/forms.json", import.meta.url));

const { heads, issues } = loadReferenceData(PACKAGES);
if (issues.length > 0) throw new Error(JSON.stringify(issues, null, 2));

const table: Record<string, unknown> = {};
for (const h of heads) table[`${h.package}/${h.head}`] = ownForms(headForms(h.entry.examples));

mkdirSync(dirname(FORMS_TABLE), { recursive: true });
writeFileSync(FORMS_TABLE, JSON.stringify(table));
console.log(`forms for ${heads.length} heads -> ${FORMS_TABLE}`);
