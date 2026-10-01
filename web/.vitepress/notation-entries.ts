// `virtual:notation-entries`: every package's notation entry, as the manifest lists them
// (`NOTATIONS`, read from each `package.json`'s `enumeratio.notation`), by manifest name.
// Imported statically: the entries are light, and a kernel needs all of them before it builds
// its engine, whose LaTeX dictionary is fixed at construction.

import { NOTATIONS } from "@enumeratio/manifest";
import type { Plugin } from "vite";

const ID = "virtual:notation-entries";
const RESOLVED = `\0${ID}`;

export function notationEntriesPlugin(): Plugin {
  return {
    name: "enumeratio-notation-entries",
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return undefined;
      const entries = Object.entries(NOTATIONS);
      return [
        ...entries.map(([, specifier], i) => `import { notation as n${i} } from ${JSON.stringify(specifier)};`),
        `export default { ${entries.map(([name], i) => `${JSON.stringify(name)}: n${i}`).join(", ")} };`,
      ].join("\n");
    },
  };
}
