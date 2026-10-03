// Build and test from packed tarballs, with no workspace links: the check that the packages
// work as published artifacts (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos §5, step 0).
//
//   node tools/tarball-check/run.ts [--out DIR] [--scratch DIR] [--only a,b] [--keep] [--probe-sources]
//
// Steps, in order (--only picks some; a step needs those before it, so --only census still packs and installs):
//   pack     `pnpm pack` every package under packages/ into <scratch>/tarballs
//   static   read each tarball as a consumer would: every `exports` target is in it, every import and every file read
//            at run time is too, every import is a declared dependency, and no export is TypeScript (Node won't run it)
//   install  a throwaway app depending on the .tgz files alone, `overrides` sending every internal
//            dependency to its tarball, so nothing resolves to the workspace
//   census   packages/census's tests, extracted from its tarball and run beside the install
//   site     web/ copied beside the install and built with SITE_FROM_PACKAGES=1 (no `srcAliases`)
//
// Exits 1 if a step failed. The report (report.md, report.json, a log per step) is written to --out.
//
// --probe-sources is diagnostic: it repacks each package with its whole tree (src, records, docs, …) and its
// TypeScript stripped to JavaScript, and gives the site the `packages/` it reaches into by relative path, to see
// past the failures that stop a run at its first and find what breaks after them.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules, stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";

const repo = resolve(import.meta.dirname, "../..");
const STEPS = ["pack", "static", "install", "census", "site"] as const;
type Step = (typeof STEPS)[number];

const { values: args } = parseArgs({
  options: {
    out: { type: "string" },
    scratch: { type: "string" },
    only: { type: "string" },
    keep: { type: "boolean", default: false },
    "probe-sources": { type: "boolean", default: false },
  },
});
const scratch = resolve(args.scratch ?? mkdtempSync(join(tmpdir(), "tarball-check-")));
const out = resolve(args.out ?? join(scratch, "report"));
const wanted = new Set<string>(args.only?.split(",") ?? STEPS);
const bad = [...wanted].filter((s) => !(STEPS as readonly string[]).includes(s));
if (bad.length > 0) throw new Error(`--only: unknown step ${bad.join(", ")} (steps are ${STEPS.join(", ")})`);
// A later step wants what the earlier ones made.
const runs = (step: Step): boolean =>
  STEPS.indexOf(step) <= Math.max(...[...wanted].map((s) => STEPS.indexOf(s as Step)));

const tarballs = join(scratch, "tarballs");
const unpacked = join(scratch, "unpacked");
const app = join(scratch, "app");
for (const dir of [tarballs, unpacked, app, out]) mkdirSync(dir, { recursive: true });

interface Finding {
  /** The package the problem belongs to (or `site`, `install`). */
  package: string;
  /** A short class, so the report groups what shares a cause. */
  kind: string;
  detail: string;
}
interface Result {
  step: Step;
  status: "pass" | "fail" | "skipped";
  seconds: number;
  note?: string;
  log?: string;
  findings: Finding[];
}
const results: Result[] = [];

/** Run a command, its output to a log file in the report; returns the exit status. */
function sh(
  step: string,
  cmd: string,
  cmdArgs: string[],
  options: { cwd: string; env?: Record<string, string> },
): number {
  const log = join(out, `${step}.log`);
  const started = Date.now();
  const run = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  const text = `$ ${[cmd, ...cmdArgs].join(" ")}\n(in ${options.cwd}, ${((Date.now() - started) / 1000).toFixed(0)}s)\n\n${run.stdout}${run.stderr}`;
  writeFileSync(log, text, { flag: "a" });
  return run.status ?? 1;
}
const tail = (step: string, lines = 25): string => {
  const log = join(out, `${step}.log`);
  return existsSync(log) ? readFileSync(log, "utf8").trimEnd().split("\n").slice(-lines).join("\n") : "";
};

// ---- the packages ----

interface Pkg {
  name: string;
  slug: string;
  dir: string;
  manifest: Manifest;
  tarball?: string;
}
interface Manifest {
  name: string;
  version: string;
  files?: string[];
  exports?: unknown;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}
const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

/** Every package a consumer could install: packages/*, and the symbol libraries under packages/symbols/<group>/*. */
function workspacePackages(): Pkg[] {
  const subdirs = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "node_modules")
      .map((e) => join(dir, e.name));
  const packages = join(repo, "packages");
  const dirs = subdirs(packages).flatMap((dir) =>
    basename(dir) === "symbols" ? subdirs(dir).flatMap(subdirs) : [dir],
  );
  return dirs
    .filter((dir) => existsSync(join(dir, "package.json")))
    .map((dir) => ({ dir, manifest: readManifest(dir) }))
    .map(({ dir, manifest }) => ({
      dir,
      manifest,
      name: manifest.name,
      slug: manifest.name.replace(/^@/, "").replace("/", "-"),
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

function timed(step: Step, body: (result: Result) => void | Promise<void>): Promise<Result> | Result {
  const result: Result = { step, status: "pass", seconds: 0, findings: [] };
  results.push(result);
  const started = Date.now();
  const done = (): Result => {
    result.seconds = Math.round((Date.now() - started) / 1000);
    if (result.log === undefined && existsSync(join(out, `${step}.log`))) result.log = `${step}.log`;
    return result;
  };
  const fail = (error: unknown): Result => {
    result.status = "fail";
    result.note = (error as Error).message;
    return done();
  };
  try {
    const ran = body(result);
    return ran instanceof Promise ? ran.then(done, fail) : done();
  } catch (error) {
    return fail(error);
  }
}

// ---- pack ----

const packages = workspacePackages();

function pack(result: Result): void {
  for (const pkg of packages) {
    const code = sh("pack", "pnpm", ["pack", "--pack-destination", tarballs], { cwd: pkg.dir });
    const file = join(tarballs, `${pkg.slug}-${pkg.manifest.version}.tgz`);
    if (code !== 0 || !existsSync(file)) {
      result.findings.push({ package: pkg.name, kind: "pack failed", detail: `pnpm pack exited ${code}` });
      continue;
    }
    if (args["probe-sources"]) addWholeTree(pkg, file);
    pkg.tarball = file;
  }
  if (result.findings.length > 0) result.status = "fail";
  result.note = `${packages.filter((p) => p.tarball !== undefined).length} of ${packages.length} packed`;
}

/**
 * The tarball with the package's whole tree added to it (less node_modules and tests) and its TypeScript
 * stripped to JavaScript, for --probe-sources: what the packages would be if they published their sources.
 */
function addWholeTree(pkg: Pkg, file: string): void {
  const dir = join(scratch, "whole", pkg.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  spawnSync("tar", ["-xzf", file, "-C", dir]);
  cpSync(pkg.dir, join(dir, "package"), {
    recursive: true,
    force: false,
    errorOnExist: false,
    filter: (src) => !/(^|\/)(node_modules|tests?|\.scratch)(\/|$)/.test(relative(pkg.dir, src)),
  });
  const root = join(dir, "package");
  for (const path of listing(root)) {
    if (!/(?<!\.d)\.ts$/.test(path)) continue;
    const code = stripTypeScriptTypes(readFileSync(join(root, path), "utf8"), { mode: "transform" });
    // Relative specifiers and URLs name the .js files now.
    writeFileSync(
      join(root, path.replace(/\.ts$/, ".js")),
      code.replace(/(["'])(\.{1,2}\/[^"'\n]*?)\.ts\1/g, "$1$2.js$1"),
    );
    rmSync(join(root, path));
  }
  const manifest = join(root, "package.json");
  writeFileSync(manifest, readFileSync(manifest, "utf8").replace(/\.ts"/g, '.js"'));
  spawnSync("tar", ["-czf", file, "-C", dir, "package"]);
}

// ---- static: the tarballs read as a consumer sees them ----

const tar = (...tarArgs: string[]): string => {
  const run = spawnSync("tar", tarArgs, { encoding: "utf8", maxBuffer: 1 << 30 });
  if (run.status !== 0) throw new Error(`tar ${tarArgs.join(" ")}: ${run.stderr}`);
  return run.stdout;
};

/** Every string leaf of an `exports` / `bin` value (conditions, arrays and subpaths alike). */
function targetsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(targetsOf);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(targetsOf);
  return [];
}

const CODE = /\.(?:m?js|cjs|m?ts|cts|vue)$/;
// What a tarball's own tests, scripts and config import isn't what a consumer runs.
const NOT_SHIPPED_CODE = /(^|\/)(tests?|scripts|node_modules|reference|docs)\/|\.test\.|(^|\/)vite\.config\./;
const RELATIVE_URL = /new URL\(\s*["'](\.\.?\/[^"'\n]+)["']\s*,\s*import\.meta\.url/g;
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"'\n]+)["']/g;
const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith(".") || specifier.startsWith("/") || BUILTINS.has(specifier)) return undefined;
  if (/^(node|data|https?|virtual|\/@):/.test(specifier) || specifier.startsWith("#")) return undefined;
  const parts = specifier.split("/");
  const name = specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  // Prose in a string (`from "the call"`) isn't a package.
  return NPM_NAME.test(name) ? name : undefined;
}
const NPM_NAME = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

function unpack(pkg: Pkg): string {
  const dir = join(unpacked, pkg.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  tar("-xzf", pkg.tarball!, "-C", dir, "--strip-components=1");
  return dir;
}

function listing(dir: string): string[] {
  const walk = (sub: string): string[] =>
    readdirSync(join(dir, sub), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(sub, e.name)) : [join(sub, e.name)],
    );
  return walk("");
}

function staticChecks(result: Result): void {
  for (const pkg of packages) {
    if (pkg.tarball === undefined) continue;
    const dir = unpack(pkg);
    const files = new Set(listing(dir));
    const found = (finding: Omit<Finding, "package">): number =>
      result.findings.push({ package: pkg.name, ...finding });
    const manifest = readManifest(dir);

    // Every export target is in the tarball (a `*` subpath needs at least one match).
    const wants = [...targetsOf(manifest.exports), ...targetsOf(manifest.bin)].filter((t) => t.startsWith("./"));
    const missing = new Map<string, string[]>();
    for (const target of new Set(wants)) {
      const path = target.slice(2);
      const present = path.includes("*")
        ? [...files].some((f) =>
            new RegExp(`^${path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace("*", ".*")}$`).test(f),
          )
        : files.has(path);
      if (present) continue;
      const top = path.split("/")[0]!;
      missing.set(top, [...(missing.get(top) ?? []), target]);
    }
    for (const [top, targets] of missing)
      found({
        kind: `exports point outside the tarball (${top}/)`,
        detail: `${targets.length} of the exports, e.g. ${targets.slice(0, 3).join(", ")}; "files" is ${JSON.stringify(manifest.files ?? null)}`,
      });

    // Every import in shipped code is a declared dependency.
    const declared = new Set([
      ...Object.keys(manifest.dependencies ?? {}),
      ...Object.keys(manifest.peerDependencies ?? {}),
      ...Object.keys(manifest.optionalDependencies ?? {}),
    ]);
    const undeclared = new Map<string, string[]>();
    const absent = new Map<string, string[]>();
    for (const file of files) {
      if (!CODE.test(file) || NOT_SHIPPED_CODE.test(file)) continue;
      for (const [, specifier] of readFileSync(join(dir, file), "utf8").matchAll(SPECIFIER)) {
        if (specifier!.startsWith(".")) {
          // A relative import of a file the tarball lacks: generated and gitignored, or outside `files`.
          const target = join(dirname(file), specifier!.replace(/[?#].*$/, ""));
          // A `.mjs` specifier in a declaration file means the `.d.mts` beside it.
          const asTypes = target.replace(/\.(m?)js$/, ".d.$1ts");
          const resolves =
            files.has(asTypes) ||
            ["", ".ts", ".mts", ".js", ".mjs", ".json", "/index.ts", "/index.js", "/index.mjs"].some((ext) =>
              files.has(`${target}${ext}`),
            );
          if (!resolves) absent.set(target, [...(absent.get(target) ?? []), file]);
          continue;
        }
        const name = packageOf(specifier!);
        if (name === undefined || name === manifest.name || declared.has(name)) continue;
        undeclared.set(name, [...(undeclared.get(name) ?? []), file]);
      }
    }
    for (const file of files) {
      if (!CODE.test(file) || NOT_SHIPPED_CODE.test(file)) continue;
      // `new URL("../x", import.meta.url)`: a file beside the code, read at run time.
      for (const [, specifier] of readFileSync(join(dir, file), "utf8").matchAll(RELATIVE_URL)) {
        const target = join(dirname(file), specifier!);
        // A folder counts as there when any file is under it.
        const present = files.has(target) || [...files].some((f) => f.startsWith(`${target.replace(/\/$/, "")}/`));
        if (!present) absent.set(target, [...(absent.get(target) ?? []), file]);
      }
    }
    for (const [target, users] of absent)
      found({
        kind: target.startsWith("..") ? "reads outside its own package" : "imports a file the tarball lacks",
        detail: `${target} from ${users.slice(0, 3).join(", ")}`,
      });
    // Node won't run TypeScript from node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
    const entries = [...new Set(wants)].filter((t) => /(?<!\.d)\.m?ts$/.test(t) && files.has(t.slice(2)));
    if (entries.length > 0)
      found({
        kind: "exports TypeScript source",
        detail: `${entries.length} exports, e.g. ${entries.slice(0, 3).join(", ")}`,
      });
    // One finding per package and kind: a list of the packages, each with one file that imports it.
    for (const dev of [true, false]) {
      const names = [...undeclared.keys()].filter((name) => name in (manifest.devDependencies ?? {}) === dev);
      if (names.length > 0)
        found({
          kind: dev ? "imports a devDependency" : "imports an undeclared package",
          detail: names
            .map((name) => `${name} (${undeclared.get(name)![0]}${undeclared.get(name)!.length > 1 ? ", …" : ""})`)
            .join("; "),
        });
    }
  }
  if (result.findings.length > 0) result.status = "fail";
  result.note = `${result.findings.length} findings in ${new Set(result.findings.map((f) => f.package)).size} packages`;
}

// ---- install ----

/** The workspace's own settings (catalog, allowBuilds, release-age exclusions), with `packages:` replaced. */
function scratchWorkspace(overrides: Record<string, string>): string {
  const lines = readFileSync(join(repo, "pnpm-workspace.yaml"), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("packages:"));
  let end = start + 1;
  while (end < lines.length && /^\s+-\s/.test(lines[end]!)) end++;
  const kept = [...lines.slice(0, start), ...lines.slice(end)].join("\n");
  const entries = Object.entries(overrides).map(([name, spec]) => `  "${name}": "${spec}"`);
  return [
    "packages:",
    '  - "."',
    // A package may import only what it declares: pnpm's default hoisting would let it find the rest.
    "hoist: false",
    kept.trimEnd(),
    "overrides:",
    ...entries,
    "",
  ].join("\n");
}

function install(result: Result): void {
  const packed = packages.filter((p) => p.tarball !== undefined);
  const specs = Object.fromEntries(packed.map((p) => [p.name, `file:${p.tarball}`]));
  // What the consumers (the site, census) need that no tarball brings: their own external dependencies.
  const external: Record<string, string> = {};
  for (const dir of [join(repo, "web"), join(repo, "packages/census")]) {
    const manifest = readManifest(dir);
    for (const [name, range] of Object.entries({ ...manifest.dependencies, ...manifest.devDependencies }))
      if (!name.startsWith("@enumeratio/") && name !== "@playwright/test") external[name] = range;
  }
  writeFileSync(
    join(app, "package.json"),
    `${JSON.stringify({ name: "tarball-check-app", version: "0.0.0", private: true, type: "module", dependencies: { ...external, ...specs } }, null, 2)}\n`,
  );
  writeFileSync(join(app, "pnpm-workspace.yaml"), scratchWorkspace(specs));
  const code = sh("install", "pnpm", ["install", "--no-frozen-lockfile"], { cwd: app });
  if (code !== 0) {
    result.status = "fail";
    result.findings.push({ package: "install", kind: "pnpm install failed", detail: tail("install", 12) });
    return;
  }
  // No internal package may have come from anywhere but its tarball: the lockfile names no registry version.
  const lock = readFileSync(join(app, "pnpm-lock.yaml"), "utf8");
  const stray = [...lock.matchAll(/^ {2}'?(@enumeratio\/[\w-]+)@(?!file:)[^\s':]+/gm)].map((m) => m[1]!);
  for (const name of new Set(stray))
    result.findings.push({ package: name, kind: "resolved from the registry", detail: "an override missed it" });
  const missing = packed.filter((p) => !existsSync(join(app, "node_modules", p.name)));
  for (const p of missing)
    result.findings.push({ package: p.name, kind: "not installed", detail: "absent from node_modules" });
  if (result.findings.length > 0) result.status = "fail";
}

// ---- census ----

interface VitestJson {
  numTotalTests: number;
  numFailedTests: number;
  numPassedTests: number;
  testResults: {
    name: string;
    status: string;
    message: string;
    assertionResults: { status: string; title: string; failureMessages: string[] }[];
  }[];
}

function firstLine(message: string): string {
  const line = message.split("\n").find((l) => l.trim() !== "" && !/^\s*at /.test(l)) ?? "";
  // Absolute scratch paths differ per run; the report groups by what's left.
  return line.replaceAll(scratch, "<scratch>").slice(0, 300);
}

function census(result: Result): void {
  const census = packages.find((p) => p.name === "@enumeratio/census");
  if (census?.tarball === undefined) throw new Error("census was not packed");
  const dir = join(app, "census");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  tar("-xzf", census.tarball, "-C", dir, "--strip-components=1");
  const json = join(out, "census.json");
  const code = sh(
    "census",
    join(app, "node_modules/.bin/vp"),
    ["test", "run", "--maxWorkers=2", "--reporter=json", `--outputFile=${json}`],
    {
      cwd: dir,
      env: { CI: "1" },
    },
  );
  if (!existsSync(json)) {
    result.status = "fail";
    result.findings.push({ package: "@enumeratio/census", kind: "tests did not run", detail: tail("census", 12) });
    return;
  }
  const report = JSON.parse(readFileSync(json, "utf8")) as VitestJson;
  result.note = `${report.numPassedTests} passed, ${report.numFailedTests} failed in ${report.testResults.length} files`;
  for (const file of report.testResults) {
    if (file.status === "passed") continue;
    const failures = file.assertionResults.filter((a) => a.status === "failed");
    const failed = failures.length;
    result.findings.push({
      package: "@enumeratio/census",
      kind: failed === 0 ? "test file did not load" : `${failed} tests failed`,
      detail: `${relative(dir, file.name)}: ${failed === 0 ? firstLine(file.message) : failures.map((a) => `${a.title} (${firstLine(a.failureMessages.join("\n"))})`).join("; ")}`,
    });
  }
  if (code !== 0 || result.findings.length > 0) result.status = "fail";
}

// ---- site ----

function site(result: Result): void {
  const web = join(app, "web");
  rmSync(web, { recursive: true, force: true });
  cpSync(join(repo, "web"), web, {
    recursive: true,
    filter: (src) => !/(^|\/)node_modules(\/|$)|\.vitepress\/(dist|cache)(\/|$)/.test(relative(join(repo, "web"), src)),
  });
  // web/tsconfig.json extends the repo's.
  cpSync(join(repo, "tsconfig.json"), join(app, "tsconfig.json"));
  // --probe-sources: the files the site reaches by `../../../packages/…`, so the build gets past them.
  if (args["probe-sources"])
    cpSync(join(repo, "packages"), join(app, "packages"), {
      recursive: true,
      filter: (src) => !/(^|\/)(node_modules|dist|tests?|\.scratch)(\/|$)/.test(relative(join(repo, "packages"), src)),
    });
  // Shortcuts into the repo that the install can't have: seen all at once, before the build stops at the first.
  for (const file of listing(web)) {
    if (!/\.(?:m?ts|vue|js)$/.test(file) || /(^|\/)(tests?|node_modules)\/|\.test\.ts$/.test(file)) continue;
    const lines = readFileSync(join(web, file), "utf8").split("\n");
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*)/.test(line)) return;
      const src = /["'](@enumeratio\/[\w-]+\/(?:[\w-]+\/)*src[^"']*)["']/.exec(line)?.[1];
      if (src !== undefined)
        result.findings.push({
          package: "site",
          kind: "imports a /src shortcut",
          detail: `web/${file}:${i + 1} ${src}`,
        });
      const path = /["'`]((?:\.\.\/)+(?:packages|tools)\/[^"'`]*)["'`]/.exec(line)?.[1];
      if (path !== undefined)
        result.findings.push({
          package: "site",
          kind: "reaches into packages/ by relative path",
          detail: `web/${file}:${i + 1} ${path}`,
        });
    });
  }
  // The install's own `.bin`, so nothing resolves through the repo.
  const code = sh("site", join(app, "node_modules/.bin/vitepress"), ["build", "web"], {
    cwd: app,
    env: { SITE_FROM_PACKAGES: "1", NODE_OPTIONS: "--max-old-space-size=6144" },
  });
  if (code !== 0 || !existsSync(join(web, ".vitepress/dist/index.html"))) {
    result.status = "fail";
    result.findings.push({ package: "site", kind: "vitepress build failed", detail: tail("site", 15) });
    result.note = `build failed, ${result.findings.length} findings`;
    return;
  }
  const pages = listing(join(web, ".vitepress/dist")).filter((f) => f.endsWith(".html")).length;
  result.note = `${pages} pages`;
  if (result.findings.length > 0) result.status = "fail";
}

// ---- run, report ----

const skipped = (step: Step, why: string): Result => {
  const result: Result = { step, status: "skipped", seconds: 0, note: why, findings: [] };
  results.push(result);
  return result;
};

async function main(): Promise<void> {
  const plan: [Step, (r: Result) => void | Promise<void>][] = [
    ["pack", pack],
    ["static", staticChecks],
    ["install", install],
    ["census", census],
    ["site", site],
  ];
  let broken = "";
  for (const [step, body] of plan) {
    if (!runs(step)) continue;
    // Packing and installing are what the rest stand on; the static read stands on packing only.
    const needs = step === "pack" ? "" : step === "static" ? "pack" : "install";
    const blocked = needs === "" ? "" : results.find((r) => r.step === needs && r.status === "fail") ? needs : "";
    if (blocked !== "" || (broken !== "" && step !== "static")) {
      skipped(step, `${blocked || broken} failed`);
      continue;
    }
    const result = await timed(step, body);
    if (result.status === "fail" && (step === "pack" || step === "install")) broken = step;
    console.log(`${step}: ${result.status}${result.note ? ` (${result.note})` : ""}`);
  }
  writeReport();
  if (!args.keep && !args.scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

function writeReport(): void {
  writeFileSync(join(out, "report.json"), `${JSON.stringify(results, null, 2)}\n`);
  const lines = ["# Tarball check", "", "| step | status | time | |", "| --- | --- | --- | --- |"];
  for (const r of results) lines.push(`| ${r.step} | ${r.status} | ${r.seconds}s | ${r.note ?? ""} |`);
  for (const r of results) {
    if (r.findings.length === 0) continue;
    lines.push("", `## ${r.step}`);
    const byKind = new Map<string, Finding[]>();
    for (const f of r.findings) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
    for (const [kind, findings] of byKind) {
      lines.push("", `### ${kind}`, "");
      for (const f of findings) lines.push(`- \`${f.package}\`: ${f.detail.replaceAll("\n", "\n  ")}`);
    }
  }
  writeFileSync(join(out, "report.md"), `${lines.join("\n")}\n`);
  console.log(`report: ${join(out, "report.md")}`);
}

await main();
