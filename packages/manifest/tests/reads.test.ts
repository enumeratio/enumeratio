// The dist-cache key (tools/ci/dist-cache.ts) hashes a package's own files, its declared
// dependencies and its `enumeratio.reads`. A build or test that names a path inside another
// package without one of those is a read the key cannot see.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { buildSourceWalkers, declared, lex, reads, scanners, sourceScanners } from "../../../tools/ci/reads.ts";
import { loadWorkspace, RECORDS, root, SOURCES } from "../../../tools/ci/workspace.ts";

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

test("a package whose tests walk every package's sources declares the sources", () => {
  const bad = [...sourceScanners(PACKAGES)]
    .filter(([name]) => !PACKAGES.get(name)!.reads.includes(SOURCES))
    .map(([name, file]) => `${file} walks every package's sources: list "${SOURCES}" in ${name}'s enumeratio.reads`);
  expect(bad).toEqual([]);
});

// `SOURCES` is left out of the dist-cache key (a test's walk moves no build output), so a build that
// walks sources under it would be invisible to the key.
test("a package declaring the sources has no build script or config that walks them", () => {
  const bad = [...buildSourceWalkers(PACKAGES)]
    .filter(([name]) => PACKAGES.get(name)!.reads.includes(SOURCES))
    .map(
      ([name, file]) =>
        `${file} walks every package's sources at build time, which "${SOURCES}" in ${name} doesn't cover`,
    );
  expect(bad).toEqual([]);
});

test("lex keeps comments, strings and code apart", () => {
  const { code, masked, strings } = lex(
    [
      'const globs = ["packages/*"]; // join("x")',
      "/* join('y') */ const re = /[\"']join\\(/g; const t = `a${join(\"b\")}c`;",
      "",
    ].join("\n"),
  );
  expect(strings).toEqual(["packages/*", "a", "b", "c"]);
  expect(code).toContain('"packages/*"');
  expect(code).not.toMatch(/join\("x"\)|join\('y'\)/);
  // The call in the regex's class, the comments and the strings is not code; the one in `${…}` is.
  expect(masked.match(/join\(/g)).toHaveLength(1);
});

test("a declared read names something that exists", () => {
  const bad: string[] = [];
  for (const pkg of PACKAGES.values())
    for (const read of pkg.reads)
      if (read !== RECORDS && read !== SOURCES && !existsSync(join(root, read)))
        bad.push(`${pkg.name}: ${read} doesn't exist`);
  expect(bad).toEqual([]);
});
