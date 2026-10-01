// Write each system's `in` for every reference example (forms.ts) into its head's record (the
// values files), keeping what the kernels answered, what people wrote and our own forms' pins.
// Run after changing a transpiler or an example:
//
//   UPDATE_FORMS=1 node packages/frontend/scripts/collect-forms.ts
//
// (The variable is a guard: tests/forms.test.ts names this command when the records and the
// printers disagree, and nothing should rewrite 600 files by accident.)

import { orderImplementations } from "@enumeratio/entry";
import { updateHead } from "@enumeratio/entry/node";
import { SYSTEMS } from "@enumeratio/oracle/src";
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
  const next = orderImplementations(
    recordWithForms(h.entry.examples, h.implementations),
    h.entry.examples.map((e) => e.id),
    SYSTEMS.map((s) => s.name),
  );
  const current = orderImplementations(
    h.implementations ?? {},
    h.entry.examples.map((e) => e.id),
    SYSTEMS.map((s) => s.name),
  );
  if (JSON.stringify(next) === JSON.stringify(current)) continue;
  await updateHead(h.dir, h.head, { implementations: Object.keys(next).length === 0 ? undefined : next });
  written++;
}
console.log(`${written} of ${heads.length} records rewritten`);
