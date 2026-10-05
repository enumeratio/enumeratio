// Every reference record goes through the one writer (@enumeratio/entry/node's writeYaml:
// stringifyYaml, then oxfmt), so a file is exactly what that writer makes of its own data. The generated data the site and
// the crosswalk read stays in step with the records.

import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import { isWrittenHead } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import { ORACLE_AGREEMENTS } from "../src/crosswalk/oracle-agreements-data.ts";
import { loadReferenceData, oracleAgreementsOf, PACKAGES, referenceData } from "../src/node.ts";

const loaded = loadReferenceData(PACKAGES);

test("every record loads, validates, and has no id collisions", () => {
  expect(loaded.issues).toEqual([]);
});

test("every record is what the writer would write", async () => {
  const drift: string[] = [];
  for (const { dir, head, folder } of loaded.heads)
    for (const file of await isWrittenHead(dir, head)) drift.push(`${folder.slice(PACKAGES.length)}/${file}`);
  expect(drift, "run `node packages/reference/scripts/format-records.ts`").toEqual([]);
});

// A reference binding's defining expression is copied into the YAML; analytic declares
// the head from its own copy, and the two must stay the same.
test("reference bindings match analytic's DEFINITIONS", () => {
  for (const { entry } of loaded.heads)
    for (const impl of entry.bindings ?? [])
      if (impl.origin === "reference" && entry.name in DEFINITIONS)
        expect(impl.expr, entry.name).toEqual(DEFINITIONS[entry.name as keyof typeof DEFINITIONS]);
});

// Built (gitignored) by the package's `build`; this checks that the build ran against these records.
test("the built oracle-agreements-data.ts tallies the current records", () => {
  expect(
    ORACLE_AGREEMENTS,
    "rebuild: pnpm --filter @enumeratio/reference run build (or node packages/reference/scripts/collect-oracle-agreements.ts)",
  ).toEqual(oracleAgreementsOf(referenceData()));
});
