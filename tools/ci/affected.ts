#!/usr/bin/env node
// Which packages a change can affect, so CI tests only those (and builds only what they read).
//
//   node tools/ci/affected.ts [--base origin/main] [--full] [--json] [--github-output]
//
// A change selects the package that owns each changed file plus everything that depends on it
// (declared or implicit, see workspace.ts). Anything that can change every package (the lockfile,
// root config, CI, the engine and its patches) selects all of them.

import { appendFileSync } from "node:fs";
import { closure, dependents, git, loadWorkspace, owner } from "./workspace.ts";

const WEB = "@enumeratio/web";

/** Suites that read other packages' files (every package.json, every record, every source), so a
 *  change anywhere can move them. */
const SCANNERS = ["@enumeratio/utils", "@enumeratio/manifest"];

/** Packages whose change can move every other package. */
const EVERYTHING = ["@enumeratio/engine", "@enumeratio/ce-patches"];

/** Test shards by package; whatever is left runs in `rest`. Mirrors the matrix in ci.yml. */
export const SHARDS: Record<string, string[]> = {
  statistics: ["@enumeratio/statistics"],
  combinatorics: ["@enumeratio/combinatorics"],
};

/** Root-level files no package reads. */
const INERT = /^(?:[^/]+\.md|LICENSE|\.vscode\/|\.vite-hooks\/|\.claude\/|\.scratch\/)/;

/** Records and manifests any package's tests or the reference's collectors may scan. */
const SCANNED = /(?:^|\/)(?:reference\/|package\.json$)/;

export interface Selection {
  full: boolean;
  /** Packages whose tests run (never web: it has its own job). */
  test: string[];
  /** Packages to build for those tests: the tests' packages and everything they read. */
  build: string[];
  /** Whether the site build can differ: web/ changed, or a package web reads (or a record it scans). */
  site: boolean;
}

function changes(base: string): { path: string; deleted: boolean }[] {
  const from = git("merge-base", base, "HEAD").trim();
  const out = new Map<string, boolean>();
  for (const line of git("diff", "--name-status", "--no-renames", from).split("\n")) {
    const [status, path] = line.split("\t");
    if (path) out.set(path, status === "D");
  }
  for (const path of git("ls-files", "-o", "--exclude-standard").split("\n")) if (path) out.set(path, false);
  return [...out].map(([path, deleted]) => ({ path, deleted }));
}

export function select(base: string, forceFull = false): Selection {
  const pkgs = loadWorkspace();
  const all = [...pkgs.keys()].filter((n) => n !== WEB).toSorted();
  const dependentsOf = dependents(pkgs);
  const everything: Selection = { full: true, test: all, build: all, site: true };
  if (forceFull) return everything;

  const seeds = new Set<string>();
  let site = false;
  /** Packages whose own tests read what changed, but whose dependents don't. */
  const scanning = new Set<string>(SCANNERS);
  for (const { path, deleted } of changes(base)) {
    const pkg = owner(pkgs, path);
    if (pkg === undefined) {
      if (!INERT.test(path)) return everything;
      continue;
    }
    if (EVERYTHING.includes(pkg.name)) return everything;
    seeds.add(pkg.name);
    // Records and manifests are read by the site's reference pages whichever package holds them.
    if (SCANNED.test(path)) site = true;
    // Records and manifests are read repo-wide; a vanished file may be one a record points at.
    if (SCANNED.test(path) || deleted) scanning.add("@enumeratio/reference");
  }
  const siteReads = closure([WEB], (n) => pkgs.get(n)?.deps ?? []);
  site ||= [...seeds].some((n) => siteReads.has(n));
  seeds.delete(WEB);
  // Nothing outside web and root docs changed: nothing to test.
  if (seeds.size === 0) return { full: false, test: [], build: [], site };
  const test = closure(seeds, (n) => dependentsOf.get(n) ?? []);
  for (const n of scanning) test.add(n);
  test.delete(WEB);
  const build = closure(test, (n) => pkgs.get(n)?.deps ?? []);
  build.delete(WEB);
  return { full: false, test: [...test].toSorted(), build: [...build].toSorted(), site };
}

export function shards(test: string[]): Record<string, string[]> {
  const claimed = new Set(Object.values(SHARDS).flat());
  return {
    ...Object.fromEntries(Object.entries(SHARDS).map(([k, v]) => [k, test.filter((n) => v.includes(n))])),
    rest: test.filter((n) => !claimed.has(n)),
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (name: string): boolean => args.includes(`--${name}`);
  const base = args[args.indexOf("--base") + 1] ?? "origin/main";
  const sel = select(args.includes("--base") ? base : "origin/main", flag("full"));
  const byShard = shards(sel.test);
  if (flag("json")) console.log(JSON.stringify({ ...sel, shards: byShard }, null, 2));
  else {
    console.log(`${sel.full ? "full run" : "affected"}: ${sel.test.length} to test, ${sel.build.length} to build`);
    for (const [shard, names] of Object.entries(byShard)) console.log(`  ${shard}: ${names.join(" ") || "(none)"}`);
    console.log(`  build: ${sel.build.join(" ")}`);
    console.log(`  site build: ${sel.site}`);
  }
  const out = process.env.GITHUB_OUTPUT;
  if (flag("github-output") && out !== undefined) {
    // The shards that have something to run, as a job matrix.
    const matrix = Object.entries(byShard)
      .filter(([, names]) => names.length > 0)
      .map(([shard, names]) => ({ shard, pkgs: names.join(" ") }));
    const lines = [`full=${sel.full}`, `site=${sel.site}`, `matrix=${JSON.stringify(matrix)}`];
    appendFileSync(out, `${lines.join("\n")}\n`);
  }
}
