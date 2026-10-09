// The dist-cache key and the affected-package selection on a small copy of the workspace: a record
// change moves the keys of the packages that read it, and selects every package that declares
// `@records`. Each case is a few git calls on a temp repository, well under the standard budget.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { root } from "../../../tools/ci/workspace.ts";

let dir: string;

function put(file: string, text: string): void {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

function pkg(name: string, enumeratio: object = {}): void {
  put(`packages/${name}/package.json`, JSON.stringify({ name: `@enumeratio/${name}`, enumeratio }));
  put(`packages/${name}/src/index.ts`, `export const ${name} = 1;\n`);
}

const git = (...args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
const node = (...args: string[]): string =>
  execFileSync("node", [join(dir, "tools/ci", args[0]!), ...args.slice(1)], { cwd: dir, encoding: "utf8" });

function keys(): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of node("dist-cache.ts", "keys").trim().split("\n")) {
    const [key, id] = line.split(" ");
    out.set(id!, key!);
  }
  return out;
}

const COMBINATORICS = "@enumeratio/combinatorics";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "ci-keys-"));
  cpSync(join(root, "tools/ci"), join(dir, "tools/ci"), { recursive: true });
  put("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  put("package.json", '{"name":"root"}\n');
  put("pnpm-lock.yaml", "lockfileVersion: 9\n");
  pkg("statistics");
  pkg("elsewhere");
  pkg("combinatorics", { reads: ["../statistics/reference"] });
  pkg("census", { reads: ["@records"] });
  pkg("catalog", { reads: ["@records"] });
  put("packages/statistics/reference/Mean/index.md", "mean\n");
  put("packages/elsewhere/reference/Other/index.md", "other\n");
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("a statistics record change moves combinatorics' key", () => {
  const before = keys().get(COMBINATORICS);
  put("packages/statistics/reference/Mean/index.md", "mean, changed\n");
  expect(keys().get(COMBINATORICS)).not.toBe(before);
  git("checkout", "--", ".");
});

test("an unrelated record change leaves combinatorics' key alone", () => {
  const before = keys().get(COMBINATORICS);
  put("packages/elsewhere/reference/Other/index.md", "other, changed\n");
  expect(keys().get(COMBINATORICS)).toBe(before);
  git("checkout", "--", ".");
});

test("a record change selects every package that declares the records", () => {
  put("packages/elsewhere/reference/Other/index.md", "other, changed\n");
  const picked = JSON.parse(node("affected.ts", "--base", "HEAD", "--json")) as { test: string[] };
  expect(picked.test).toEqual(expect.arrayContaining(["@enumeratio/census", "@enumeratio/catalog"]));
  expect(picked.test).not.toContain(COMBINATORICS);
  git("checkout", "--", ".");
});
