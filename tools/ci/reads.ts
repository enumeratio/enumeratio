// Finds the places a package's build or tests name a path inside another workspace package.
// Each must be declared: as a dependency in package.json, or in `enumeratio.reads`, the list the
// dist-cache key hashes (dist-cache.ts). A read that is neither is invisible to the key.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { git, owner, RECORDS, root, type Pkg } from "./workspace.ts";

/** What `RECORDS` covers: a package's `reference/` folder and its manifest. */
export const RECORD_PATH = /(?:^|\/)(?:reference(?:\/|$)|package\.json$)/;

/** Files whose relative paths can reach a sibling: code and manifests, not records or docs. */
const READERS = /\.(?:[cm]?[jt]s|json)$/;
const NOT_READERS =
  /(?:^|\/)(?:node_modules|dist|reference|docs|generated)\/|\.generated\.|(?:^|\/)tsconfig[^/]*\.json$/;

/** A string literal that starts with `../`: a path (or an import specifier) leaving its directory. */
const ESCAPE = /["'`]((?:\.\.\/)+[^"'`\s]*)/g;

export interface Read {
  readonly pkg: string;
  /** Repo-relative file holding the literal. */
  readonly file: string;
  /** Repo-relative path it names, inside `target`. */
  readonly path: string;
  readonly target: string;
}

/** Paths a package's files name inside other workspace packages, whether or not declared. */
export function reads(pkgs: Map<string, Pkg>): Read[] {
  const out: Read[] = [];
  for (const file of git("ls-files", "-z").split("\0")) {
    if (!READERS.test(file) || NOT_READERS.test(file)) continue;
    const home = owner(pkgs, file);
    if (home === undefined) continue;
    const text = readFileSync(join(root, file), "utf8");
    // A literal is a path from its file, or from the package (a script's `at("../statistics/reference")`).
    // The file's reading wins when that path exists, then the package's; else the file's.
    for (const m of text.matchAll(ESCAPE)) {
      const fromFile = resolve(root, dirname(file), m[1]!);
      const fromPackage = resolve(root, home.dir, m[1]!);
      const at = existsSync(fromFile) || !existsSync(fromPackage) ? fromFile : fromPackage;
      const path = relative(root, at).replaceAll("\\", "/");
      const target = owner(pkgs, `${path}/`);
      if (target !== undefined && target.name !== home.name)
        out.push({ pkg: home.name, file, path, target: target.name });
    }
  }
  return out;
}

/** Calls that walk every package's records (`@enumeratio/entry/node`, `@enumeratio/reference/node`). */
const WHOLE_REPO = /@enumeratio\/reference\/node|\b(?:loadReferenceData|referenceData|recordDirs|packageDirs)\b/;
/** A build script running another package's script, which may walk the records itself. */
const SIBLING_SCRIPT = /(?:\.\.\/)+reference\/scripts\//;

/** Packages whose build scripts walk every package's records, and where. */
export function scanners(pkgs: Map<string, Pkg>): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of git("ls-files", "-z").split("\0")) {
    const home = owner(pkgs, file);
    if (home === undefined || out.has(home.name)) continue;
    const rel = relative(home.dir, file);
    const script = /^scripts\/[^/]+\.m?ts$/.test(rel) && WHOLE_REPO.test(readFileSync(join(root, file), "utf8"));
    const build = rel === "package.json" && SIBLING_SCRIPT.test(home.buildScript ?? "");
    if (script || build) out.set(home.name, file);
  }
  return out;
}

/** Whether `read` is covered by a declared dependency or by `enumeratio.reads`. */
export function declared(pkgs: Map<string, Pkg>, read: Read): boolean {
  const p = pkgs.get(read.pkg)!;
  if (p.declared.has(read.target)) return true;
  return p.reads.some((r) =>
    r === RECORDS ? RECORD_PATH.test(read.path) : read.path === r || read.path.startsWith(`${r}/`),
  );
}
