// The reads tools/ci/reads.ts finds on a small copy of the workspace: the forms a package names a
// sibling by (join, resolve, new URL, a package.json script, a tsconfig's include and references),
// and a test or build script that walks every package's sources. Each form is in its own file, so a
// failure names the form.

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { root } from "../../../tools/ci/workspace.ts";

let dir: string;
let found: {
  reads: { file: string; path: string; target: string }[];
  scanners: string[];
  buildWalkers: string[];
};

function put(file: string, text: string): void {
  mkdirSync(dirname(join(dir, file)), { recursive: true });
  writeFileSync(join(dir, file), text);
}

const git = (...args: string[]): string => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

function pkg(name: string): void {
  put(`packages/${name}/package.json`, JSON.stringify({ name: `@enumeratio/${name}` }));
}

/** The repo-relative paths a file names inside other packages, sorted and without repeats. */
function pathsIn(file: string): string[] {
  return [...new Set(found.reads.filter((r) => r.file === file).map((r) => r.path))].toSorted();
}

/** Lines of source, so a fixture reads as the file it writes. */
const lines = (...ls: string[]): string => `${ls.join("\n")}\n`;

const LISTS_AND_READS = lines(
  'import { readFileSync } from "node:fs";',
  'import { loadWorkspace } from "../../../tools/ci/workspace.ts";',
  "export const text = [...loadWorkspace().values()].map((p) => readFileSync(p.dir + '/package.json', 'utf8'));",
);

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "reads-forms-"));
  cpSync(join(root, "tools/ci"), join(dir, "tools/ci"), { recursive: true });
  // The probe runs the tools from the copy, so its `root` is the fixture.
  put(
    "tools/ci/probe.ts",
    lines(
      'import { buildSourceWalkers, reads, sourceScanners } from "./reads.ts";',
      'import { loadWorkspace } from "./workspace.ts";',
      "const pkgs = loadWorkspace();",
      "const scanners = [...sourceScanners(pkgs).keys()];",
      "const buildWalkers = [...buildSourceWalkers(pkgs).keys()];",
      "console.log(JSON.stringify({ reads: reads(pkgs), scanners, buildWalkers }));",
    ),
  );
  put("pnpm-workspace.yaml", "packages:\n  - packages/*\n");
  put("package.json", '{"name":"root","type":"module"}\n');
  for (const name of [
    "statistics",
    "elsewhere",
    "reference",
    "symbols",
    "joiner",
    "dynamic",
    "embedded",
    "walker",
    "renamed",
    "globber",
    "follower",
    "builder",
    "quiet",
  ])
    pkg(name);
  put("packages/statistics/src/index.ts", "export const x = 1;\n");
  put("packages/statistics/reference/Mean/index.md", "mean\n");
  put("packages/statistics/scripts/check.ts", "export {};\n");
  put("packages/elsewhere/src/index.ts", "export const y = 1;\n");
  put("packages/elsewhere/reference/Other/index.md", "other\n");
  put("packages/joiner/tests/fixtures/data.json", "{}\n");
  // `join` with literal `..` segments, a nested call among the arguments, a literal sibling
  // path from the root, and a path inside the package itself (which is not a read).
  put(
    "packages/joiner/tests/join.test.ts",
    lines(
      'import { dirname, join, resolve } from "node:path";',
      'import { fileURLToPath } from "node:url";',
      "const here = import.meta.dirname;",
      'export const a = join(here, "..", "..", "statistics", "reference");',
      'export const b = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "statistics");',
      'export const c = resolve(process.cwd(), "packages", "elsewhere", "reference");',
      'export const own = join(here, "fixtures");',
    ),
  );
  put(
    "packages/joiner/tests/url.test.ts",
    'export const url = new URL("../../elsewhere/reference/", import.meta.url);\n',
  );
  put(
    "packages/joiner/tsconfig.json",
    lines(
      "{",
      "  // a tsconfig's include and references reach a sibling",
      '  "include": ["../statistics/src/**/*.ts"],',
      '  "references": [{ "path": "../elsewhere" }]',
      "}",
    ),
  );
  // A script in package.json runs from the package's folder.
  put(
    "packages/joiner/package.json",
    JSON.stringify({
      name: "@enumeratio/joiner",
      scripts: { build: "tsc", test: "node ../statistics/scripts/check.ts && vp test", own: "node scripts/x.ts" },
    }),
  );
  // Only the literal run after the base is a path: `join(root, "packages", name, "reference")` is
  // `packages/<name>/reference`, never `packages/reference`. A glob ends the run too.
  put(
    "packages/dynamic/tests/dynamic.test.ts",
    lines(
      'import { join } from "node:path";',
      'export const a = join(root, "packages", name, "reference");',
      'export const b = join(PACKAGES, "symbols", group, pkg);',
      'export const c = join(root, "packages", "*", "reference");',
      'export const d = join(root, "packages", "statistics", name);',
      'export const e = [name, "reference"].join("/");',
    ),
  );
  // A path written in a comment, a string or a template is text, not a read: a test's fixtures
  // are full of them.
  put(
    "packages/embedded/tests/fixture.test.ts",
    lines(
      '// join(here, "..", "..", "statistics") and "../../elsewhere" in a comment',
      "/* new URL('../../elsewhere/reference/', import.meta.url) */",
      'export const a = \'export const a = join(here, "..", "..", "statistics", "reference");\';',
      "export const b = 'new URL(\"../../elsewhere/reference/\", import.meta.url)';",
      'export const c = `join(here, "..", "..", "elsewhere")`;',
    ),
  );
  put(
    "packages/embedded/tsconfig.json",
    lines(
      "{",
      '  "include": ["src", /* "../statistics/src", */ "tests"], // "../elsewhere"',
      '  "references": []',
      "}",
    ),
  );
  // A test that lists the packages and reads their files walks every package's sources; one that
  // lists them and reads none does not.
  put("packages/walker/tests/walk.test.ts", LISTS_AND_READS);
  put(
    "packages/quiet/tests/quiet.test.ts",
    'import { loadWorkspace } from "../../../tools/ci/workspace.ts";\nexport const names = loadWorkspace().keys();\n',
  );
  // The same walk with its own helper names (nothing called `repoRoot`), under a package that
  // lists a tree below packages/.
  put(
    "packages/renamed/tests/tree.test.ts",
    lines(
      'import { readdirSync, readFileSync } from "node:fs";',
      'import { join } from "node:path";',
      "export const listEverything = (dir: string): string[] =>",
      "  readdirSync(dir).flatMap((f) => (f.endsWith('.ts') ? [readFileSync(join(dir, f), 'utf8')] : listEverything(join(dir, f))));",
      'export const all = listEverything(join(import.meta.dirname, "..", "..", "..", "packages"));',
    ),
  );
  // A glob string opens no comment: the walk after it is still code.
  put(
    "packages/globber/tests/glob.test.ts",
    `export const globs = ["packages/*"];\n${LISTS_AND_READS}/** a comment whose end the glob's \`/*\` once paired with */\n`,
  );
  // Following imports through every package (tools/static-imports.ts) reads their sources.
  put(
    "packages/follower/tests/imports.test.ts",
    'import { pathsInto } from "../../../tools/static-imports.ts";\nexport const p = pathsInto("x", /y/);\n',
  );
  // A build script's walk can't be declared, and a test walking only its own folder isn't one.
  put("packages/builder/scripts/build.ts", LISTS_AND_READS);
  put(
    "packages/builder/tests/own.test.ts",
    'import { readdirSync, readFileSync } from "node:fs";\nexport const own = readdirSync(import.meta.dirname + "/fixtures").map((f) => readFileSync(f));\n',
  );
  git("init", "-q");
  git("add", "-A");
  const out = execFileSync("node", [join(dir, "tools/ci/probe.ts")], { cwd: dir, encoding: "utf8" });
  found = JSON.parse(out) as typeof found;
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("join() and resolve() reach a sibling by their literal segments, and not into their own package", () => {
  expect(pathsIn("packages/joiner/tests/join.test.ts")).toEqual([
    "packages/elsewhere/reference",
    "packages/statistics",
    "packages/statistics/reference",
  ]);
});

test("join() reads the literals after its base up to the first computed one, never across it", () => {
  expect(pathsIn("packages/dynamic/tests/dynamic.test.ts")).toEqual(["packages/statistics"]);
});

test("new URL('../…', import.meta.url) reaches a sibling", () => {
  expect(pathsIn("packages/joiner/tests/url.test.ts")).toEqual(["packages/elsewhere/reference"]);
});

test("a tsconfig's include and references reach a sibling", () => {
  expect(pathsIn("packages/joiner/tsconfig.json")).toEqual(["packages/elsewhere", "packages/statistics/src"]);
});

test("a package.json script reaching a sibling is a read, one inside the package is not", () => {
  expect(pathsIn("packages/joiner/package.json")).toEqual(["packages/statistics/scripts/check.ts"]);
});

test("a path inside a comment, a string or a template is not a read", () => {
  expect(pathsIn("packages/embedded/tests/fixture.test.ts")).toEqual([]);
  expect(pathsIn("packages/embedded/tsconfig.json")).toEqual([]);
});

test("a test that walks every package's sources is found by the shape of the walk, whatever it calls its helpers", () => {
  // `quiet` lists the packages and reads nothing; `builder`'s test only walks its own folder.
  expect(found.scanners.toSorted()).toEqual(
    ["follower", "globber", "renamed", "walker"].map((n) => `@enumeratio/${n}`),
  );
});

test("a build script that walks every package's sources is found apart from the tests", () => {
  expect(found.buildWalkers).toEqual(["@enumeratio/builder"]);
});
