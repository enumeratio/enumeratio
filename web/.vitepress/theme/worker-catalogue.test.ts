import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HIERARCHY, plan } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { CATALOGUE } from "./worker-catalogue.ts";

// The catalogue names packages, and what a library needs declared first is the hierarchy's.
test("every catalogue library is a placed package, and none restates its requirements", () => {
  for (const library of CATALOGUE) {
    expect(HIERARCHY[library.name], library.name).toBeDefined();
    expect(library.requires ?? [], library.name).toEqual([]);
  }
});

test("a kernel that plans analytic doesn't bring it for anything else", () => {
  const without = CATALOGUE.map((l) => l.name).filter((name) => name !== "analytic");
  for (const name of without)
    expect(
      plan([name], CATALOGUE).libraries.map((l) => l.name),
      name,
    ).not.toContain("analytic");
});

// A package the site depends on that declares heads must be in the catalogue, or its heads
// never evaluate in the browser (statistics once was not).
test("every declaring package the site depends on is in the catalogue", () => {
  const root = join(import.meta.dirname, "../..");
  const read = (path: string): { dependencies?: object; enumeratio?: { declare?: unknown[] } } =>
    JSON.parse(readFileSync(join(root, path), "utf8"));
  const have = new Set(CATALOGUE.map((l) => l.name));
  const missing = Object.keys(read("package.json").dependencies ?? {})
    .filter((dep) => dep.startsWith("@enumeratio/"))
    .filter((dep) => (read(`node_modules/${dep}/package.json`).enumeratio?.declare?.length ?? 0) > 0)
    .map((dep) => dep.slice("@enumeratio/".length))
    // The kernel declares evaluation itself, before any library.
    .filter((name) => name !== "evaluation" && !have.has(name));
  expect(missing).toEqual([]);
});
