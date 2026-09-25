// Every reference record goes through the one writer (@enumeratio/entry's stringifyYaml), so
// a file is exactly what that writer makes of its own data. The generated data the site and
// the crosswalk read stays in step with the records.

import { readFileSync } from "node:fs";
import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import { isCanonicalYaml } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import AGREEMENTS from "../src/crosswalk/oracle-agreements.json" with { type: "json" };
import { loadReferenceData, oracleAgreementsOf, PACKAGES, referenceData } from "../src/node.ts";

const loaded = loadReferenceData(PACKAGES);

test("every record loads, validates, and has no id collisions", () => {
  expect(loaded.issues).toEqual([]);
});

test("every record is what the writer would write", () => {
  const drift = loaded.heads
    .map((h) => h.entryPath)
    .filter((path) => !isCanonicalYaml(readFileSync(path, "utf8")))
    .map((path) => path.slice(PACKAGES.length));
  expect(drift, "re-serialise with stringifyYaml from @enumeratio/entry").toEqual([]);
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
