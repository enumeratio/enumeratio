// A checkout's packages and the libraries installed beside them are one set; the tree wins a name.

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vite-plus/test";
import { packageDirs, recordDirs } from "../src/node.ts";
import { removeHead, writeHead } from "../src/record.ts";

const root = mkdtempSync(join(tmpdir(), "package-dirs-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const write = (path: string, json: unknown): void => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(json));
};

// packages/census depends on `lib` (installed) and `dup` (installed, but the tree has one too).
const packages = join(root, "packages");
write(join(packages, "census", "package.json"), {
  name: "@enumeratio/census",
  dependencies: { "@enumeratio/lib": "1.0.0" },
  devDependencies: { "@enumeratio/dup": "1.0.0", "@enumeratio/absent": "1.0.0", vite: "1" },
});
mkdirSync(join(packages, "census", "reference"), { recursive: true });
mkdirSync(join(packages, "symbols", "g", "dup", "reference"), { recursive: true });
const installed = join(root, "store");
for (const name of ["lib", "dup"]) {
  write(join(installed, name, "package.json"), { name: `@enumeratio/${name}` });
  mkdirSync(join(installed, name, "reference"), { recursive: true });
  mkdirSync(join(packages, "census", "node_modules", "@enumeratio"), { recursive: true });
  symlinkSync(join(installed, name), join(packages, "census", "node_modules", "@enumeratio", name));
}

test("installed libraries follow the tree's packages, and the tree wins a name", () => {
  const found = packageDirs(packages).filter((p) => ["census", "dup", "lib", "absent"].includes(p.package));
  expect(found.map((p) => [p.package, p.installed === true])).toEqual([
    ["census", false],
    ["dup", false],
    ["lib", true],
  ]);
  expect(found.find((p) => p.package === "dup")!.dir).toBe(join(packages, "symbols", "g", "dup"));
});

test("records are read from both, installed last", () => {
  const dirs = recordDirs(packages).map((p) => [p.package, p.installed === true]);
  expect(dirs).toEqual([
    ["census", false],
    ["dup", false],
    ["lib", true],
  ]);
});

test("a root that is not a checkout holds only what it holds", () => {
  expect(packageDirs(join(packages, "census", "node_modules", "@enumeratio")).map((p) => p.package)).toEqual([
    "dup",
    "lib",
  ]);
});

test("an installed library's records are never written", async () => {
  const dir = join(packages, "census", "node_modules", "@enumeratio", "lib", "reference");
  expect(() => removeHead(dir, "Anything")).toThrow(/installed/);
  await expect(writeHead(dir, "Anything", {} as never)).rejects.toThrow(/installed/);
});
