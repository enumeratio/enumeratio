// Does one package build and test from its dependencies' tarballs alone? The check a package must pass
// before it can leave this repository (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos §5).
//
//   node tools/split-check/run.ts <package> [--build] [--keep] [--scratch DIR] [--out DIR] [--only a,b]
//
// <package> is a name (`@enumeratio/hopf`) or a bare one (`hopf`). The steps, in order:
//   pack      `pnpm pack` the @enumeratio packages it depends on (and theirs, by dependencies and peers)
//   install   a scratch app holding the package's files from git, its internal dependencies sent to those
//             tarballs, and nothing else from this repo: no workspace links, no hoisting
//   build     its own `build` script, run in the scratch app
//   check     its own `check` script, when it has one
//   test      its own `test` script (vitest capped at two workers)
//   pack-self `pnpm pack` the package itself: every export is in the tarball, every import is declared
//
// Needs the dependencies built (`pnpm --filter <package>^... run build`); --build does that first.
// Exits 1 if a step failed. The logs and report.md go to --out.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

const repo = resolve(import.meta.dirname, "../..");
const STEPS = ["pack", "install", "build", "check", "test", "pack-self"] as const;
type Step = (typeof STEPS)[number];

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    build: { type: "boolean", default: false },
    keep: { type: "boolean", default: false },
    scratch: { type: "string" },
    out: { type: "string" },
    only: { type: "string" },
  },
});
const wantedName = positionals[0];
if (wantedName === undefined || positionals.length > 1)
  throw new Error(
    "usage: node tools/split-check/run.ts <package> [--build] [--keep] [--scratch DIR] [--out DIR] [--only a,b]",
  );
const scratch = resolve(args.scratch ?? mkdtempSync(join(tmpdir(), "split-check-")));
const out = resolve(args.out ?? `${scratch}-report`);
const wanted = new Set<string>(args.only?.split(",") ?? STEPS);
const unknown = [...wanted].filter((s) => !(STEPS as readonly string[]).includes(s));
if (unknown.length > 0) throw new Error(`--only: unknown step ${unknown.join(", ")} (steps are ${STEPS.join(", ")})`);
const tarballs = join(scratch, "tarballs");
const app = join(scratch, "app");
for (const dir of [tarballs, app, out]) mkdirSync(dir, { recursive: true });

// ---- the workspace ----

interface Manifest {
  name: string;
  version: string;
  private?: boolean;
  scripts?: Record<string, string>;
  files?: string[];
  exports?: unknown;
  bin?: string | Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
}
interface Pkg {
  dir: string;
  manifest: Manifest;
  tarball?: string;
}
const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;

/** Every package under packages/, the libraries in packages/symbols/<group>/ included. */
function workspacePackages(): Map<string, Pkg> {
  const subdirs = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== "node_modules")
      .map((e) => join(dir, e.name));
  const packages = join(repo, "packages");
  const dirs = subdirs(packages).flatMap((dir) =>
    basename(dir) === "symbols" ? subdirs(dir).flatMap(subdirs) : [dir],
  );
  return new Map(
    dirs
      .filter((dir) => existsSync(join(dir, "package.json")))
      .map((dir): [string, Pkg] => {
        const manifest = readManifest(dir);
        return [manifest.name, { dir, manifest }];
      }),
  );
}
const workspace = workspacePackages();
const targetName = wantedName.startsWith("@") ? wantedName : `@enumeratio/${wantedName}`;
const found = workspace.get(targetName);
if (found === undefined) throw new Error(`no package ${targetName} under packages/`);
const target: Pkg = found;

/** The internal packages a consumer of `pkg` needs installed: its own, and theirs by dependencies and peers. */
function closure(): Pkg[] {
  const seen = new Map<string, Pkg>();
  const visit = (pkg: Pkg, own: boolean): void => {
    const { dependencies, peerDependencies, optionalDependencies, devDependencies } = pkg.manifest;
    // The package under test also builds and tests with its devDependencies; its dependencies' are already built.
    for (const name of Object.keys({
      ...dependencies,
      ...peerDependencies,
      ...optionalDependencies,
      ...(own ? devDependencies : {}),
    })) {
      const dep = workspace.get(name);
      if (dep === undefined || seen.has(name)) continue;
      seen.set(name, dep);
      visit(dep, false);
    }
  };
  visit(target, true);
  return [...seen.values()].toSorted((a, b) => a.manifest.name.localeCompare(b.manifest.name));
}
const deps = closure();

// ---- running ----

interface Result {
  step: Step;
  status: "pass" | "fail" | "skipped";
  seconds: number;
  note?: string;
  findings: string[];
}
const results: Result[] = [];

function sh(
  step: string,
  cmd: string,
  cmdArgs: string[],
  options: { cwd: string; env?: Record<string, string> },
): number {
  const started = Date.now();
  const run = spawnSync(cmd, cmdArgs, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    maxBuffer: 1 << 30,
  });
  const header = `$ ${[cmd, ...cmdArgs].join(" ")}\n(in ${options.cwd}, ${((Date.now() - started) / 1000).toFixed(0)}s)\n\n`;
  writeFileSync(join(out, `${step}.log`), `${header}${run.stdout}${run.stderr}\n`, { flag: "a" });
  return run.status ?? 1;
}
const tail = (step: string, lines = 20): string => {
  const log = join(out, `${step}.log`);
  return existsSync(log) ? readFileSync(log, "utf8").trimEnd().split("\n").slice(-lines).join("\n") : "";
};
const git = (...gitArgs: string[]): string => {
  const run = spawnSync("git", gitArgs, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 30 });
  if (run.status !== 0) throw new Error(`git ${gitArgs.join(" ")}: ${run.stderr}`);
  return run.stdout;
};

const slug = (name: string): string => name.replace(/^@/, "").replace("/", "-");

// ---- pack ----

function pack(result: Result): void {
  for (const pkg of deps) {
    // A package with no build script (config) ships its sources.
    if (pkg.manifest.scripts?.build !== undefined && !existsSync(join(pkg.dir, "dist")))
      result.findings.push(`${pkg.manifest.name} is not built (no dist/): pnpm --filter ${targetName}^... run build`);
  }
  if (result.findings.length > 0) return;
  for (const pkg of deps) {
    const code = sh("pack", "pnpm", ["pack", "--pack-destination", tarballs], { cwd: pkg.dir });
    const file = join(tarballs, `${slug(pkg.manifest.name)}-${pkg.manifest.version}.tgz`);
    if (code !== 0 || !existsSync(file)) result.findings.push(`${pkg.manifest.name}: pnpm pack exited ${code}`);
    else pkg.tarball = file;
  }
  result.note = `${deps.length} packed: ${deps.map((p) => p.manifest.name.replace("@enumeratio/", "")).join(", ")}`;
}

// ---- install ----

/** The repo's own pnpm settings (catalog, allowBuilds, release-age exclusions), `packages:` replaced by the one app. */
function scratchWorkspace(overrides: Record<string, string>): string {
  const lines = readFileSync(join(repo, "pnpm-workspace.yaml"), "utf8").split("\n");
  const start = lines.findIndex((l) => l.startsWith("packages:"));
  let end = start + 1;
  while (end < lines.length && /^\s+-\s/.test(lines[end]!)) end++;
  const kept = [...lines.slice(0, start), ...lines.slice(end)].join("\n");
  return [
    "packages:",
    '  - "."',
    // A package may import only what it declares: pnpm's default hoisting would let it find the rest.
    "hoist: false",
    kept.trimEnd(),
    "overrides:",
    ...Object.entries(overrides).map(([name, spec]) => `  "${name}": "${spec}"`),
    "",
  ].join("\n");
}

/** What the standalone repo would hold: the files git tracks (or would) under the package, none of its build output. */
function copySources(): void {
  const dir = target.dir.slice(repo.length + 1);
  const listed = git("ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", dir)
    .split("\0")
    .filter((f) => f !== "" && existsSync(join(repo, f)));
  for (const file of listed) {
    const to = join(app, file.slice(dir.length + 1));
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, readFileSync(join(repo, file)));
  }
}

function install(result: Result): void {
  const specs = Object.fromEntries(deps.map((p) => [p.manifest.name, `file:${p.tarball}`]));
  copySources();
  // Every `workspace:` range becomes the tarball it would be a registry release of.
  const manifest = readManifest(app);
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const entries = manifest[field];
    if (entries === undefined) continue;
    for (const [name, range] of Object.entries(entries))
      if (range.startsWith("workspace:")) {
        if (field === "peerDependencies") entries[name] = "*";
        else if (specs[name] !== undefined) entries[name] = specs[name];
        else result.findings.push(`${name}: a workspace range with no package to pack`);
      }
  }
  if (result.findings.length > 0) return;
  writeFileSync(join(app, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(app, "pnpm-workspace.yaml"), scratchWorkspace(specs));
  if (sh("install", "pnpm", ["install", "--no-frozen-lockfile"], { cwd: app }) !== 0) {
    result.findings.push(`pnpm install failed:\n${tail("install", 12)}`);
    return;
  }
  // No internal package may have come from anywhere but its tarball.
  const lock = readFileSync(join(app, "pnpm-lock.yaml"), "utf8");
  const stray = [...lock.matchAll(/^ {2}'?(@enumeratio\/[\w-]+)@(?!file:)[^\s':]+/gm)].map((m) => m[1]!);
  for (const name of new Set(stray)) result.findings.push(`${name} resolved from somewhere but its tarball`);
}

// ---- build, check, test ----

const hasScript = (name: string): boolean => target.manifest.scripts?.[name] !== undefined;

function runScript(script: string, extra: string[] = [], env: Record<string, string> = {}) {
  return (result: Result): void => {
    if (!hasScript(script)) {
      result.status = "skipped";
      result.note = `no ${script} script`;
      return;
    }
    const code = sh(script, "pnpm", ["run", script, ...(extra.length > 0 ? ["--", ...extra] : [])], {
      cwd: app,
      env: { CI: "1", ...env },
    });
    if (code !== 0) result.findings.push(`pnpm run ${script} exited ${code}:\n${tail(script, 25)}`);
  };
}

// ---- pack-self ----

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"'\n]+)["']/g;
const NPM_NAME = /^(@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const CODE = /\.(?:m?js|cjs)$/;

function targetsOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(targetsOf);
  if (value !== null && typeof value === "object") return Object.values(value).flatMap(targetsOf);
  return [];
}

function packSelf(result: Result): void {
  const dest = join(scratch, "self");
  mkdirSync(dest, { recursive: true });
  if (sh("pack-self", "pnpm", ["pack", "--pack-destination", dest], { cwd: app }) !== 0) {
    result.findings.push("pnpm pack failed");
    return;
  }
  const file = readdirSync(dest).find((f) => f.endsWith(".tgz"));
  if (file === undefined) return void result.findings.push("pnpm pack wrote no tarball");
  const list = spawnSync("tar", ["-tzf", join(dest, file)], { encoding: "utf8", maxBuffer: 1 << 30 });
  const files = new Set(
    list.stdout
      .split("\n")
      .filter(Boolean)
      .map((f) => f.replace(/^package\//, "")),
  );
  const manifest = target.manifest;
  const missing = [...new Set([...targetsOf(manifest.exports), ...targetsOf(manifest.bin)])]
    .filter((t) => t.startsWith("./") && !files.has(t.slice(2)))
    .map((t) => t.slice(2));
  if (missing.length > 0) result.findings.push(`exports missing from the tarball: ${missing.join(", ")}`);
  const declared = new Set(
    Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies, ...manifest.optionalDependencies }),
  );
  const undeclared = new Map<string, string>();
  const extract = join(scratch, "self-unpacked");
  rmSync(extract, { recursive: true, force: true });
  mkdirSync(extract, { recursive: true });
  spawnSync("tar", ["-xzf", join(dest, file), "-C", extract, "--strip-components=1"]);
  for (const f of files) {
    if (!CODE.test(f)) continue;
    for (const [, specifier] of readFileSync(join(extract, f), "utf8").matchAll(SPECIFIER)) {
      if (/^[./#]/.test(specifier!) || BUILTINS.has(specifier!) || /^(node|data|https?):/.test(specifier!)) continue;
      const parts = specifier!.split("/");
      const name = specifier!.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
      if (NPM_NAME.test(name) && name !== manifest.name && !declared.has(name)) undeclared.set(name, f);
    }
  }
  for (const [name, f] of undeclared) result.findings.push(`${f} imports ${name}, which the package doesn't declare`);
  result.note = `${files.size} files`;
}

// ---- run ----

const FOUNDATION: Step[] = ["pack", "install", "build"];
const plan: [Step, (r: Result) => void][] = [
  ["pack", pack],
  ["install", install],
  ["build", runScript("build")],
  ["check", runScript("check")],
  ["test", runScript("test", ["--maxWorkers=2"])],
  ["pack-self", packSelf],
];

function main(): void {
  console.log(
    `${targetName} from ${deps.length} tarballs: ${deps.map((p) => p.manifest.name.replace("@enumeratio/", "")).join(", ")}`,
  );
  if (args.build) {
    const code = sh("prebuild", "pnpm", ["--filter", `${targetName}^...`, "run", "build"], { cwd: repo });
    if (code !== 0) throw new Error(`building the dependencies failed:\n${tail("prebuild", 25)}`);
  }
  // A step stands on those before it, so --only test still packs, installs and builds.
  const last = Math.max(...[...wanted].map((s) => STEPS.indexOf(s as Step)));
  let broken = "";
  for (const [step, body] of plan) {
    if (STEPS.indexOf(step) > last) break;
    const result: Result = { step, status: "pass", seconds: 0, findings: [] };
    results.push(result);
    const skip =
      broken !== "" ? `${broken} failed` : !wanted.has(step) && !FOUNDATION.includes(step) ? "not asked for" : "";
    if (skip !== "") {
      result.status = "skipped";
      result.note = skip;
      continue;
    }
    const started = Date.now();
    try {
      body(result);
    } catch (error) {
      result.findings.push((error as Error).message);
    }
    result.seconds = Math.round((Date.now() - started) / 1000);
    if (result.findings.length > 0) result.status = "fail";
    // A failed check or test still leaves a package to pack; a failed pack, install or build doesn't.
    if (result.status === "fail" && FOUNDATION.includes(step)) broken = step;
    console.log(`${step}: ${result.status}${result.note ? ` (${result.note})` : ""}`);
    for (const finding of result.findings) console.log(`  - ${finding.replaceAll("\n", "\n    ")}`);
  }
  const lines = [`# Split check: ${targetName}`, "", "| step | status | time | |", "| --- | --- | --- | --- |"];
  for (const r of results) lines.push(`| ${r.step} | ${r.status} | ${r.seconds}s | ${r.note ?? ""} |`);
  for (const r of results.filter((r) => r.findings.length > 0)) {
    lines.push("", `## ${r.step}`, "");
    for (const f of r.findings) lines.push(`- ${f.replaceAll("\n", "\n  ")}`);
  }
  writeFileSync(join(out, "report.md"), `${lines.join("\n")}\n`);
  console.log(`report: ${join(out, "report.md")}`);
  if (!args.keep && !args.scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
  process.exitCode = results.some((r) => r.status === "fail") ? 1 : 0;
}

main();
