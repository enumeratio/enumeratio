// Between the data flip and the consumers moving onto the loader (design/examples-as-data.md
// §8, steps 4–5), the entries modules are shims generated from the YAML. The YAML is the
// source: these fail when a shim is edited by hand, or the two drift.

import { readFileSync } from "node:fs";
import { DEFINITIONS } from "@enumeratio/analytic/definitions";
import { isCanonicalYaml } from "@enumeratio/entry";
import { expect, test } from "vite-plus/test";
import { readEntry, ROOT, SHIMS, sourcesOf } from "../scripts/migrate/shims.ts";
import { loadReferenceData } from "../src/node.ts";

const FIX = "run `node packages/reference/scripts/migrate/shims.ts` after editing the YAML";

const loaded = loadReferenceData(`${ROOT}packages`);
const onDisk = new Set(loaded.heads.map((h) => h.entryPath.slice(ROOT.length)));

test("every YAML record loads, validates, and has no id collisions", () => {
  expect(loaded.issues).toEqual([]);
});

test("every YAML file is in exactly one shim, and every shim source exists", () => {
  const listed = SHIMS.flatMap((s) => sourcesOf(s.path));
  expect(listed.filter((s, i) => listed.indexOf(s) !== i)).toEqual([]);
  expect([...onDisk].filter((s) => !listed.includes(s)).sort()).toEqual([]);
  expect(listed.filter((s) => !onDisk.has(s))).toEqual([]);
});

for (const shim of SHIMS) {
  test(`${shim.path} is its YAML`, async () => {
    const mod = (await import(`${ROOT}${shim.path}`)) as Record<string, unknown>;
    expect(mod[shim.name], FIX).toEqual(sourcesOf(shim.path).map(readEntry));
  });
}

test("every YAML file is what the writer would write", () => {
  const drift = [...onDisk].filter(
    (path) => !isCanonicalYaml(readFileSync(`${ROOT}${path}`, "utf8")),
  );
  expect(drift, "re-serialise with stringifyYaml from @enumeratio/entry").toEqual([]);
});

// The YAML copies a reference implementation's defining expression; analytic declares the
// head from its own copy, and the two must stay the same.
test("reference implementations match analytic's DEFINITIONS", () => {
  for (const { entry } of loaded.heads)
    for (const impl of entry.implementations ?? [])
      if (impl.origin === "reference" && entry.name in DEFINITIONS)
        expect(impl.expr, entry.name).toEqual(DEFINITIONS[entry.name as keyof typeof DEFINITIONS]);
});
