// Everything the package generates from its own sources and the records, none of it committed
// (see .gitignore). Run by `build`; the stubs come first because the sources the later scripts
// load import the compiled caches.

import { execFileSync } from "node:child_process";

const scripts = [
  "scripts/collect-statistics-naming.ts",
  "scripts/stub-generated.ts",
  "scripts/generate-map-laws.ts",
  "scripts/compile-maps.ts",
  "scripts/compile-families.ts",
  "lattice-paths/scripts/compile-definitions.ts",
  "partitions/scripts/compile-definitions.ts",
  "permutations/scripts/compile-definitions.ts",
  "set-partitions/scripts/compile-definitions.ts",
];

for (const script of scripts) execFileSync("node", [script], { stdio: "inherit" });
