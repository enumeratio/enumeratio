import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { installedLibraries } from "../scripts/installed.ts";

const pkg = (dir: string, name: string): string => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name }));
  return dir;
};

test("installed libraries: those resolving outside the workspace, once each", () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "installed-")));
  const root = join(tmp, "packages");
  const host = pkg(join(root, "host"), "@enumeratio/host");
  const sibling = pkg(join(root, "sibling"), "@enumeratio/sibling");
  const hopf = pkg(join(tmp, "store", "hopf"), "@enumeratio/hopf");
  const scope = join(host, "node_modules", "@enumeratio");
  mkdirSync(scope, { recursive: true });
  symlinkSync(sibling, join(scope, "sibling")); // a workspace link
  symlinkSync(hopf, join(scope, "hopf"));
  symlinkSync(join(tmp, "gone"), join(scope, "renamed")); // dangling
  expect(installedLibraries([host, sibling], root)).toEqual([{ name: "@enumeratio/hopf", dir: hopf }]);

  // A second, different install of the same name.
  const other = pkg(join(tmp, "store", "hopf-2"), "@enumeratio/hopf");
  mkdirSync(join(sibling, "node_modules", "@enumeratio"), { recursive: true });
  symlinkSync(other, join(sibling, "node_modules", "@enumeratio", "hopf"));
  expect(() => installedLibraries([host, sibling], root)).toThrow(/installed twice/);
});
