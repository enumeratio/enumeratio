// A page's shell and the theme components a docs or reference page renders load no engine:
// cells ask the kernel, and anything else that needs one imports it when it's used. A chain
// in the failure names the import to make lazy, type-only, or the kernel's.

import { fileURLToPath } from "node:url";
import { pathsInto } from "@enumeratio/frontend/static-imports";
import { expect, test } from "vite-plus/test";

const ENGINE = /^@cortex-js\/compute-engine/;
const theme = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

test.each([
  "./index.mts",
  "./Layout.vue",
  "./components/ReferencePage.vue",
  "./components/ReferenceIndex.vue",
  "./components/Symbol.vue",
  "./components/Story.vue",
  "./components/LiveInput.vue",
])("%s loads no engine", (path) => {
  expect(pathsInto(theme(path), ENGINE)).toEqual([]);
});
