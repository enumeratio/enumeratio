// The theme is server-rendered, and the packages that define custom elements touch
// `HTMLElement` when imported, which fails the page's server chunk silently and prerenders it
// empty (the only symptom is a hydration mismatch). A theme module reaches them only through
// `import()` inside `onMounted`. A chain in the failure names the static import to make lazy.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pathsInto } from "../../../tools/static-imports.ts";
import { expect, test } from "vite-plus/test";

// `components/stories-data` is generated data and touches no DOM.
const BROWSER_ONLY = /^(@enumeratio\/components(?!\/stories-data)(\/|$)|lit(\/|-|$)|@lit\/|mathlive(\/|$))/;
const here = fileURLToPath(new URL(".", import.meta.url));

const modules = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(vue|mts)$/.test(entry.name))
    .map((entry) => `${entry.parentPath}/${entry.name}`);

test.each(modules(here))("%s imports no browser-only module statically", (file) => {
  expect(pathsInto(file, BROWSER_ONLY)).toEqual([]);
});
