// A build is slow and its worktree is being edited, so what it reads can change under it. Its outputs
// then belong to neither key: the dist-cache (tools/ci/dist-cache.ts) and a generation step's stamp
// (scripts/stamp.ts) must save nothing instead of filing them under the key from before the edit.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { root } from "../../../tools/ci/workspace.ts";
import { cached } from "../scripts/stamp.ts";

let dir: string;
let store: string;

function put(file: string, text: string): void {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

const git = (...args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
const tars = (): string[] => readdirSync(store).filter((f) => f.endsWith(".tar"));
const build = (): string =>
  execFileSync("node", ["tools/ci/dist-cache.ts", "build", "slow"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, DIST_CACHE_DIR: store },
  });

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "dist-cache-race-"));
  store = join(dir, "store");
  cpSync(join(root, "tools/ci"), join(dir, "tools/ci"), { recursive: true });
  put("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  put("package.json", '{"name":"root"}\n');
  put("pnpm-lock.yaml", "lockfileVersion: 9\n");
  put("packages/slow/package.json", JSON.stringify({ name: "@enumeratio/slow", scripts: { build: "node build.js" } }));
  put("packages/slow/.gitignore", "dist\n");
  put("packages/slow/src.txt", "before\n");
  // Copies its input to dist, then an edit lands before the build returns (`edit` file present).
  put(
    "packages/slow/build.js",
    `const fs = require("fs");
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync("dist/out.txt", fs.readFileSync("src.txt"));
if (fs.existsSync("edit")) fs.writeFileSync("src.txt", "after\\n");
`,
  );
  git("init", "-q");
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "base");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("dist-cache stores nothing when an input changes during the build, then caches the settled build", () => {
  put("packages/slow/edit", "");
  expect(build()).toContain("not cached");
  expect(existsSync(store) ? tars() : []).toEqual([]);

  rmSync(join(dir, "packages/slow/edit"));
  expect(build()).toContain("built");
  expect(tars()).toHaveLength(1);
  expect(readFileSync(join(dir, "packages/slow/dist/out.txt"), "utf8")).toBe("after\n");
  expect(build()).toContain("hit");
});

test("a generation step records no stamp when its inputs change while it runs", async () => {
  const step = join(tmpdir(), `stamp-race-${process.pid}`);
  mkdirSync(join(step, "in"), { recursive: true });
  writeFileSync(join(step, "package.json"), '{"name":"step"}\n');
  writeFileSync(join(step, "in/data.txt"), "one\n");
  const inputs = { dir: step, roots: [join(step, "in")] };
  const out = join(step, "out.txt");
  try {
    await cached("race", inputs, [out], () => {
      writeFileSync(out, "built from one\n");
      writeFileSync(join(step, "in/data.txt"), "two\n");
    });
    expect(existsSync(join(step, "node_modules/.cache/enumeratio/race.stamp"))).toBe(false);

    const settled = { dir: step, roots: [join(step, "in")] };
    expect(await cached("race", settled, [out], () => writeFileSync(out, "built from two\n"))).toBe(true);
    expect(existsSync(join(step, "node_modules/.cache/enumeratio/race.stamp"))).toBe(true);
  } finally {
    rmSync(step, { recursive: true, force: true });
  }
});
