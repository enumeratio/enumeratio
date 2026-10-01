// A page of cells loads no engine: what a cell's elements and the front end's `/core` entry
// load before their code runs never reaches compute-engine. A chain in the failure says
// which import to make lazy (`import()`), type-only, or the kernel's.

import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { pathsInto } from "./static-imports.ts";

const ENGINE = /^@cortex-js\/compute-engine/;
const source = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

test.each(["lazy", "notatio-cell", "notatio-in", "notatio-out", "notatio-code"])("%s loads no engine", (name) => {
  expect(pathsInto(source(`../src/${name}.ts`), ENGINE)).toEqual([]);
});

test("the front end's /core entry loads no engine", () => {
  expect(pathsInto(source("../../frontend/src/core.ts"), ENGINE)).toEqual([]);
});
