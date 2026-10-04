// A page of cells or plots loads no engine: what their elements and the front end's `/core`
// entry load before their code runs never reaches compute-engine. A chain in the failure says
// which import to make lazy (`import()`), type-only, or the kernel's.

import { readFileSync } from "node:fs";
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

test("lazy.ts loads every element the main entry defines, by its own module", () => {
  const index = readFileSync(source("../src/index.ts"), "utf8");
  const defined = [...index.matchAll(/^import "\.\/(notatio-[a-z0-9-]+)\.ts";$/gm)].map((m) => m[1]);
  expect([...LAZY_TAGS].toSorted()).toEqual(defined.toSorted());
});
