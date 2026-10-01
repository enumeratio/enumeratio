// The compiled caches are imported statically by the sources the compile scripts load, so each
// needs a file before its script can run. An empty one is valid: an entry is used only while its
// hash matches, otherwise the definition compiles on first use or is interpreted.
//
//   node scripts/stub-generated.ts

import { existsSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const STUBS: Record<string, string> = {
  "../src/compiled-maps.generated.js": "COMPILED_MAPS",
  "../collections/src/families/compiled-families.generated.js": "COMPILED_FAMILIES",
  "../lattice-paths/src/statistics.compiled.generated.js": "COMPILED",
  "../partitions/src/statistics.compiled.generated.js": "COMPILED",
  "../permutations/src/statistics.compiled.generated.js": "COMPILED",
  "../set-partitions/src/statistics.compiled.generated.js": "COMPILED",
};

for (const [path, name] of Object.entries(STUBS)) {
  const file = fileURLToPath(new URL(path, import.meta.url));
  if (!existsSync(file))
    writeFileSync(file, `// Stub until the build compiles the definitions.\nexport const ${name} = {};\n`);
}
