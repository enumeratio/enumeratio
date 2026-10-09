// The dist-cache key and the affected-package selection on a small copy of the workspace: a record
// change moves the keys of the packages that read it, and selects every package that declares
// `@records`. Each case is a few git calls on a temp repository, well under the standard budget.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  pkg("bystander");
  pkg("walker", { reads: ["@sources"] });
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

// A package declaring the sources is selected by a change anywhere; a plain one only through what it reads.
test("a change in an unrelated package selects a package that declares the sources, and not a bystander", () => {
  put("packages/elsewhere/src/index.ts", "export const elsewhere = 2;\n");
  const picked = JSON.parse(node("affected.ts", "--base", "HEAD", "--json")) as { test: string[] };
  expect(picked.test).toEqual(["@enumeratio/elsewhere", "@enumeratio/walker"]);
  git("checkout", "--", ".");
});

// With a warm cache, building one package restores its closure and builds neither a dependent
// (combinatorics depends on boxes) nor an unrelated sibling.
test("a no-op rebuild of one package restores from the cache and builds nothing else", () => {
  const sub = mkdtempSync(join(tmpdir(), "ci-build-"));
  const sh = (cmd: string, ...args: string[]): string =>
    execFileSync(cmd, args, {
      cwd: sub,
      encoding: "utf8",
      env: { ...process.env, DIST_CACHE_DIR: join(sub, "cache") },
    });
  const write = (file: string, text: string): void => {
    mkdirSync(dirname(join(sub, file)), { recursive: true });
    writeFileSync(join(sub, file), text);
  };
  try {
    cpSync(join(root, "tools/ci"), join(sub, "tools/ci"), { recursive: true });
    write("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
    write("package.json", '{"name":"root"}\n');
    write("pnpm-lock.yaml", "lockfileVersion: 9\n");
    write(".gitignore", "dist\nnode_modules\nbuilt.log\ncache\n");
    write(
      "fake-build.cjs",
      [
        'const fs = require("fs"), path = require("path");',
        "const name = path.basename(process.cwd());",
        'fs.mkdirSync("dist", { recursive: true });',
        'fs.writeFileSync("dist/out", name);',
        'fs.appendFileSync(path.join(__dirname, "built.log"), name + "\\n");',
      ].join("\n"),
    );
    const make = (name: string, deps: string[]): void => {
      write(
        `packages/${name}/package.json`,
        JSON.stringify({
          name: `@enumeratio/${name}`,
          dependencies: Object.fromEntries(deps.map((d) => [`@enumeratio/${d}`, "workspace:*"])),
          scripts: { build: "node ../../fake-build.cjs" },
        }),
      );
      write(`packages/${name}/src/index.ts`, `export const ${name} = 1;\n`);
    };
    make("config", []);
    make("boxes", ["config"]);
    make("combinatorics", ["boxes"]);
    make("other", ["config"]);
    sh("pnpm", "install", "--lockfile-only", "--offline"); // pnpm rewrites a stub lockfile on first use
    sh("git", "init", "-q");
    sh("git", "add", "-A");
    sh("git", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");

    expect(sh("node", "tools/ci/dist-cache.ts", "build", "boxes")).toContain("0 restored, 2 built");
    rmSync(join(sub, "built.log"), { force: true });
    const again = sh("node", "tools/ci/dist-cache.ts", "build", "boxes");
    expect(again).toContain("2 restored, 0 built");
    expect(again).not.toMatch(/combinatorics|other/);
    expect(existsSync(join(sub, "built.log"))).toBe(false);
  } finally {
    rmSync(sub, { recursive: true, force: true });
  }
});

test("a record change doesn't select a package that declares no reads", () => {
  put("packages/statistics/reference/Mean/index.md", "mean, changed\n");
  const picked = JSON.parse(node("affected.ts", "--base", "HEAD", "--json")) as { test: string[] };
  expect(picked.test).not.toContain("@enumeratio/bystander");
  git("checkout", "--", ".");
});
