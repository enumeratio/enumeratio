// Write every reference example's forms (forms.ts) into its head's implementations record,
// keeping what the kernels answered and what people wrote. Run after changing a printer, a
// transpiler or an example:
//
//   UPDATE_FORMS=1 node packages/notatio/scripts/collect-forms.ts
//
// (The variable is a guard: tests/forms.test.ts names this command when the records and the
// printers disagree, and nothing should rewrite 600 files by accident.)

import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { writeYaml } from "@enumeratio/entry/node";
import { loadReferenceData, PACKAGES } from "@enumeratio/reference/node";
import { recordWithForms } from "./forms.ts";

if (process.env.UPDATE_FORMS !== "1") {
  console.error("refusing to rewrite the records without UPDATE_FORMS=1");
  process.exit(1);
}

const { heads, issues } = loadReferenceData(PACKAGES);
if (issues.length > 0) throw new Error(JSON.stringify(issues, null, 2));

let written = 0;
for (const h of heads) {
  const next = recordWithForms(h.entry.examples, h.implementations);
  if (isDeepStrictEqual(next, h.implementations ?? {})) continue;
  const path = h.implementationsPath ?? join(dirname(h.entryPath), `${h.head}.implementations.yaml`);
  if (Object.keys(next).length === 0) {
    if (existsSync(path)) rmSync(path);
  } else await writeYaml(path, next);
  written++;
}
console.log(`${written} of ${heads.length} records rewritten`);
