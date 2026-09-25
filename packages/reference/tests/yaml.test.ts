// Every reference record goes through the one writer (@enumeratio/entry/node's writeYaml:
// stringifyYaml, then oxfmt), so a file is exactly what that writer makes of its own data. The generated data the site and
// the crosswalk read stays in step with the records.

import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import { isWrittenYaml } from "@enumeratio/entry/node";
import { expect, test } from "vite-plus/test";
import AGREEMENTS from "../src/crosswalk/oracle-agreements.json" with { type: "json" };
import { loadReferenceData, oracleAgreementsOf, PACKAGES, referenceData } from "../src/node.ts";

const loaded = loadReferenceData(PACKAGES);

test("every record loads, validates, and has no id collisions", () => {
  expect(loaded.issues).toEqual([]);
});

// Each example pairs with an entry in its head's implementations record: our forms at least,
// whatever else has run it (notatio/scripts/collect-forms.ts writes them).
test("every example has an implementations entry", () => {
  const missing = loaded.heads.flatMap((h) =>
    h.entry.examples.filter((e) => h.implementations?.[e.id] === undefined).map((e) => `${h.head}/${e.id}`),
  );
  expect(missing, "run UPDATE_FORMS=1 node packages/notatio/scripts/collect-forms.ts").toEqual([]);
});

test("every record is what the writer would write", async () => {
  const drift: string[] = [];
  for (const { entryPath } of loaded.heads)
    if (!(await isWrittenYaml(entryPath))) drift.push(entryPath.slice(PACKAGES.length));
  expect(drift, "run `node packages/reference/scripts/format-records.ts`").toEqual([]);
});

// A reference implementation's defining expression is copied into the YAML; analytic declares
// the head from its own copy, and the two must stay the same.
test("reference implementations match analytic's DEFINITIONS", () => {
  for (const { entry } of loaded.heads)
    for (const impl of entry.implementations ?? [])
      if (impl.origin === "reference" && entry.name in DEFINITIONS)
        expect(impl.expr, entry.name).toEqual(DEFINITIONS[entry.name as keyof typeof DEFINITIONS]);
});

test("oracle-agreements.json is current", () => {
  expect(
    AGREEMENTS,
    "regenerate: node -e 'import(\"./packages/reference/src/node.ts\").then((m) => m.writeOracleAgreements())'",
  ).toEqual(oracleAgreementsOf(referenceData()));
});
