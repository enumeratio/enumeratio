// A page of cells or plots loads no engine: what their elements and the front end's `/core`
// entry load before their code runs never reaches compute-engine. A chain in the failure says
// which import to make lazy (`import()`), type-only, or the kernel's.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pathsInto } from "../../../tools/static-imports.ts";
import { expect, test } from "vite-plus/test";
import { LAZY_TAGS } from "../src/lazy.ts";

const ENGINE = /^@cortex-js\/compute-engine/;
const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

test.each([
  "lazy",
  "scope",
  "notatio-cell",
  "notatio-in",
  "notatio-out",
  "notatio-code",
  "notatio-plot",
  "notatio-plot-3d",
  "notatio-contour-plot",
  "notatio-density-plot",
  "notatio-vector-plot",
  "notatio-polar-plot",
  "notatio-curve-3d",
  "notatio-complex-plot",
  "notatio-complex-plot-3d",
  "notatio-slider",
])("%s loads no engine", (name) => {
  expect(pathsInto(source(`../src/${name}.ts`), ENGINE)).toEqual([]);
});

test("the front end's /core entry loads no engine", () => {
  expect(pathsInto(source("../../frontend/src/core.ts"), ENGINE)).toEqual([]);
});

// A tag lazy.ts doesn't claim is defined as a generic element, so an element another one
// renders (a template's `<notatio-dynamic>`) would never be itself on a page with no kernel.
test("lazy.ts loads every element the package defines, by its own module", () => {
  const src = source("../src/");
  const defined = readdirSync(src)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) => [
      ...readFileSync(`${src}/${f}`, "utf8").matchAll(
        /(?:customElements\.define|defineControl)\(\s*"((?:notatio-[a-z0-9-]+)|table-view-box)"/g,
      ),
    ])
    .map((m) => m[1]);
  expect([...LAZY_TAGS].toSorted()).toEqual([...new Set(defined)].toSorted());
});
