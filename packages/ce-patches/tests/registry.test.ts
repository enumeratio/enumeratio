import { readFileSync, readdirSync } from "node:fs";
import { expect, test } from "vite-plus/test";
import { patchExports, renderRegistry } from "../scripts/generate-patches.ts";
import { PATCHES } from "../src/index.ts";

test("every patch file exports a Patch the registry picks up", () => {
  const files = readdirSync(new URL("../src/patches/", import.meta.url)).filter(
    (file) => file.endsWith(".ts") && file !== "registry-data.ts",
  );
  expect(patchExports().map((p) => p.file)).toEqual(files.toSorted());
});

test("the built registry is what the generator renders", () => {
  expect(readFileSync(new URL("../src/patches/registry-data.ts", import.meta.url), "utf8")).toBe(
    renderRegistry(patchExports()),
  );
  expect(PATCHES.length).toBe(patchExports().length);
});
