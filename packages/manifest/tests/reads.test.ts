// The dist-cache key (tools/ci/dist-cache.ts) hashes a package's own files, its declared
// dependencies and its `enumeratio.reads`. A build or test that names a path inside another
// package without one of those is a read the key cannot see.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { declared, reads, scanners } from "../../../tools/ci/reads.ts";
import { loadWorkspace, RECORDS, root } from "../../../tools/ci/workspace.ts";

const PACKAGES = loadWorkspace();

test("every path a package names inside another package is a dependency or a declared read", () => {
  const bad = reads(PACKAGES)
    .filter((read) => !declared(PACKAGES, read))
    .map((read) => `${read.file} reads ${read.path}: list it in ${read.pkg}'s enumeratio.reads`);
  expect([...new Set(bad)]).toEqual([]);
});

test("a package whose scripts walk every record declares the records", () => {
  const bad = [...scanners(PACKAGES)]
    .filter(([name]) => !PACKAGES.get(name)!.reads.includes(RECORDS))
    .map(([name, file]) => `${file} walks every record: list "${RECORDS}" in ${name}'s enumeratio.reads`);
  expect(bad).toEqual([]);
});

test("a declared read names something that exists", () => {
  const bad: string[] = [];
  for (const pkg of PACKAGES.values())
    for (const read of pkg.reads)
      if (read !== RECORDS && !existsSync(join(root, read))) bad.push(`${pkg.name}: ${read} doesn't exist`);
  expect(bad).toEqual([]);
});
