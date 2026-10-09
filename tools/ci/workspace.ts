// The workspace as a graph, for the CI tools beside it (affected.ts, dist-cache.ts). Plain node:
// no dependencies, so it runs before anything is built.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export interface Pkg {
  readonly name: string;
  /** Repo-relative, forward slashes. */
  readonly dir: string;
  readonly buildScript: string | undefined;
  /** Workspace names this package's build and tests read: declared, then implicit. */
  readonly deps: ReadonlySet<string>;
  /** Just the names its `package.json` declares (any field), which never form a cycle on their own. */
  readonly declared: ReadonlySet<string>;
  /**
   * Other packages' files its build or tests read without importing them: its `enumeratio.reads`,
   * repo-relative (a file or a directory), or `RECORDS` for every package's `reference/` folders
   * and manifests, or `SOURCES` for every package's sources.
   */
  readonly reads: readonly string[];
}

/** In `enumeratio.reads`: every package's records and manifests, for the scanners. */
export const RECORDS = "@records";

/** In `enumeratio.reads`: every package's sources, for the tests that walk them. Tests only: a build's
 *  outputs don't depend on a test's walk, so the dist-cache key leaves it out. */
export const SOURCES = "@sources";

export const root = resolve(import.meta.dirname, "../..");

export function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });
}

function workspaceGlobs(): string[] {
  const text = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
  const globs: string[] = [];
  let inPackages = false;
  for (const line of text.split("\n")) {
    if (line.startsWith("packages:")) inPackages = true;
    else if (/^\S/.test(line)) inPackages = false;
    else if (inPackages) {
      const m = /^\s+-\s+["']?([^"'\s#]+)/.exec(line);
      if (m) globs.push(m[1]!);
    }
  }
  return globs;
}

function expand(glob: string): string[] {
  let dirs = [""];
  for (const seg of glob.split("/")) {
    const next: string[] = [];
    for (const dir of dirs) {
      if (seg === "*") {
        const at = join(root, dir);
        if (!existsSync(at)) continue;
        for (const e of readdirSync(at, { withFileTypes: true }))
          if (e.isDirectory() && e.name !== "node_modules") next.push(dir === "" ? e.name : `${dir}/${e.name}`);
      } else next.push(dir === "" ? seg : `${dir}/${seg}`);
    }
    dirs = next;
  }
  return dirs.filter((d) => existsSync(join(root, d, "package.json")));
}

interface Manifest {
  name: string;
  enumeratio?: { reads?: string[] };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/** Every workspace package; `deps` is the declared graph plus the sibling packages a build script runs. */
export function loadWorkspace(): Map<string, Pkg> {
  const found = [...new Set(workspaceGlobs().flatMap(expand))].map((dir) => ({
    dir,
    manifest: JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")) as Manifest,
  }));
  const names = new Set(found.map((f) => f.manifest.name));
  const byDir = new Map(found.map((f) => [f.dir, f.manifest.name]));
  const pkgs = new Map<string, Pkg>();
  for (const { dir, manifest } of found) {
    const deps = new Set<string>();
    for (const field of [
      manifest.dependencies,
      manifest.devDependencies,
      manifest.peerDependencies,
      manifest.optionalDependencies,
    ])
      for (const dep of Object.keys(field ?? {})) if (names.has(dep)) deps.add(dep);
    const declared = new Set(deps);
    declared.delete(manifest.name);
    // `node ../manifest/scripts/x.ts .` reads a sibling's source without declaring it.
    const build = manifest.scripts?.build;
    for (const m of (build ?? "").matchAll(/((?:\.\.\/)+)([\w-]+)\//g)) {
      const target = relative(root, resolve(root, dir, m[1]!, m[2]!)).replaceAll("\\", "/");
      const hit = byDir.get(target);
      if (hit !== undefined) deps.add(hit);
    }
    deps.delete(manifest.name);
    const reads = (manifest.enumeratio?.reads ?? []).map((r) =>
      r === RECORDS || r === SOURCES ? r : relative(root, resolve(root, dir, r)).replaceAll("\\", "/"),
    );
    pkgs.set(manifest.name, { name: manifest.name, dir, buildScript: build, deps, declared, reads });
  }
  return pkgs;
}

/** Reverse edges: who depends on each package, or reads files it holds. */
export function dependents(pkgs: Map<string, Pkg>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>([...pkgs.keys()].map((n) => [n, new Set()]));
  for (const p of pkgs.values()) {
    for (const d of p.deps) out.get(d)?.add(p.name);
    for (const r of p.reads) {
      const holder = r === RECORDS || r === SOURCES ? undefined : owner(pkgs, `${r}/`);
      if (holder !== undefined && holder.name !== p.name) out.get(holder.name)?.add(p.name);
    }
  }
  return out;
}

/** `seeds` and everything reachable along `edges`. */
export function closure(seeds: Iterable<string>, edges: (name: string) => Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const todo = [...seeds];
  for (let n = todo.pop(); n !== undefined; n = todo.pop()) {
    if (seen.has(n)) continue;
    seen.add(n);
    todo.push(...edges(n));
  }
  return seen;
}

/** The package whose directory holds a repo-relative path (longest prefix), if any. */
export function owner(pkgs: Map<string, Pkg>, file: string): Pkg | undefined {
  let best: Pkg | undefined;
  for (const p of pkgs.values())
    if (file.startsWith(`${p.dir}/`) && (best === undefined || p.dir.length > best.dir.length)) best = p;
  return best;
}

/** Full names pass through; a bare name (`reference`) matches the part after the scope. Ambiguity is an error. */
export function resolveNames(pkgs: Map<string, Pkg>, requested: string[]): string[] {
  return requested.map((r) => {
    if (pkgs.has(r)) return r;
    const hits = [...pkgs.keys()].filter((n) => n.split("/").pop() === r);
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) throw new Error(`${r} is ambiguous: ${hits.toSorted().join(", ")}`);
    throw new Error(`no workspace package ${r}`);
  });
}
