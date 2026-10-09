// Finds the places a package's build or tests name a path inside another workspace package.
// Each must be declared: as a dependency in package.json, or in `enumeratio.reads`, the list the
// dist-cache key hashes (dist-cache.ts). A read that is neither is invisible to the key.
//
// Detected statically, on the code with its comments removed and its string literals kept apart
// from it (`lex`), so a path or call written inside a string or a comment is not a read:
//   - a string literal starting with `../` (also inside `new URL("../…", …)`);
//   - a `../…` word in a package.json script;
//   - a `join(…)` or `resolve(…)` whose literal segments, up to the first computed or glob one,
//     reach another package (from the file, its package or the repo root, whichever exists);
//   - a tsconfig's `include` or `references` entry starting with `../`.
// A test that walks every package's sources is found by the shape of the walk, whatever its
// helpers are called (`sourceScanners`), and likewise a build script's (`buildSourceWalkers`).
//
// Missed, so never declared by anything here: `./../x`; a root-relative literal outside
// join/resolve (`readFileSync("packages/x/y")`); a join base that is not the file, the package
// or the root; `import.meta.glob` with `*`; a chained `new URL(new URL(…), …)`; a tsconfig's
// `extends`, `paths` or `files`; a path built from a variable, a `${…}` or a statement away
// (`base + "/x"`); and a path that is data (a record or a config naming a file). A package named
// by its specifier (`import "@enumeratio/x"`) is a dependency, declared in package.json.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { git, owner, RECORDS, root, SOURCES, type Pkg } from "./workspace.ts";

/** What `RECORDS` covers: a package's `reference/` folder and its manifest. */
export const RECORD_PATH = /(?:^|\/)(?:reference(?:\/|$)|package\.json$)/;

/** Files whose relative paths can reach a sibling: code and manifests, and tsconfigs (below). */
const READERS = /\.(?:[cm]?[jt]s|json)$/;
const TSCONFIG = /(?:^|\/)tsconfig[^/]*\.json$/;
const NOT_READERS = /(?:^|\/)(?:node_modules|dist|reference|docs|generated)\/|\.generated\./;

/** A string literal's text starting with `../`: a path (or an import specifier) leaving its directory. */
const ESCAPE = /^((?:\.\.\/)+\S*)/;
/** A `../…` word of a package.json script, which runs from the package's folder. */
const SCRIPT_ESCAPE = /(?:^|[\s=:"'(])((?:\.\.\/)+[^\s"'`;&|)]*)/g;
/** A tsconfig's `include` or `references` array, and its `../` entries (a glob's `*` is cut off). */
const TSCONFIG_LISTS = /"(?:include|references)"\s*:\s*\[([^\]]*)\]/g;
const TSCONFIG_ESCAPE = /"(\.\.\/[^"]*)"/g;
/** A string literal argument, with no `${…}` interpolation. */
const LITERAL = /^(["'`])([^"'`$]*)\1$/;
/** A `join(…)` or `resolve(…)` call: bare or on `path`, not an array's `.join` or `Promise.resolve`. */
const PATH_CALL = /(?<![.\w])(?:join|resolve)\(|\b(?:path|posix|win32)\.(?:join|resolve)\(/g;
/** A path segment that is a glob. */
const GLOB = /[*?{[]/;

export interface Read {
  readonly pkg: string;
  /** Repo-relative file holding the literal. */
  readonly file: string;
  /** Repo-relative path it names, inside `target`. */
  readonly path: string;
  readonly target: string;
}

export interface Lexed {
  /** The source without its comments (blanked, newlines kept, so offsets agree with `masked`). */
  readonly code: string;
  /** `code` with the inside of every string, template and regex literal blanked: only real code is left. */
  readonly masked: string;
  /** The text of each string literal, and each chunk of a template literal between its `${…}`. */
  readonly strings: readonly string[];
}

/** A `/` after one of these starts a regex literal, not a division. */
const BEFORE_REGEX = /[(,=:[!&|?{};+\-*%<>~^]/;
const blank = (text: string): string => text.replace(/[^\n]/g, " ");

/**
 * Splits JS, TS or JSON into code, comments, and string, template and regex literals: the little
 * a regex over the raw text can't tell apart (`"packages/*"` is a string, not a comment opener; a
 * `join(…)` written inside a fixture string is not a call). Not a parser: a regex literal after
 * `)` or `}` reads as a division, which at worst leaves a comment in the code.
 */
export function lex(source: string): Lexed {
  let code = "";
  let masked = "";
  const strings: string[] = [];
  /** `code` frames count their `{` so a `}` can tell `${…}` from a block; `tpl` frames are template text. */
  const stack: ({ tpl: true } | { tpl: false; depth: number })[] = [{ tpl: false, depth: 0 }];
  let last = "";
  let chunk = "";
  for (let i = 0; i < source.length;) {
    const c = source[i]!;
    const n = source[i + 1];
    const top = stack[stack.length - 1]!;
    if (top.tpl) {
      if (c === "\\") {
        chunk += source.slice(i, i + 2);
        code += source.slice(i, i + 2);
        masked += blank(source.slice(i, i + 2));
        i += 2;
      } else if (c === "`" || (c === "$" && n === "{")) {
        strings.push(chunk);
        chunk = "";
        const token = c === "`" ? "`" : "${";
        code += token;
        masked += token;
        i += token.length;
        if (c === "`") stack.pop();
        else stack.push({ tpl: false, depth: 0 });
      } else {
        chunk += c;
        code += c;
        masked += c === "\n" ? c : " ";
        i++;
      }
      continue;
    }
    if (c === "/" && n === "/") {
      const end = source.indexOf("\n", i);
      const text = source.slice(i, end < 0 ? source.length : end);
      code += blank(text);
      masked += blank(text);
      i += text.length;
    } else if (c === "/" && n === "*") {
      const end = source.indexOf("*/", i + 2);
      const text = source.slice(i, end < 0 ? source.length : end + 2);
      code += blank(text);
      masked += blank(text);
      i += text.length;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== "\n") j += source[j] === "\\" ? 2 : 1;
      const body = source.slice(i + 1, Math.min(j, source.length));
      strings.push(body);
      const close = source[j] === c ? c : "";
      code += c + body + close;
      masked += c + blank(body) + close;
      i = j + close.length;
      last = c;
    } else if (c === "`") {
      stack.push({ tpl: true });
      code += c;
      masked += c;
      i++;
    } else if (c === "/" && (last === "" || BEFORE_REGEX.test(last))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== "\n" && (inClass || source[j] !== "/")) {
        if (source[j] === "\\") j++;
        else if (source[j] === "[") inClass = true;
        else if (source[j] === "]") inClass = false;
        j++;
      }
      if (source[j] === "/") {
        code += source.slice(i, j + 1);
        masked += "/" + blank(source.slice(i + 1, j)) + "/";
        i = j + 1;
      } else {
        code += c;
        masked += c;
        i++;
      }
      last = "/";
    } else {
      if (c === "{") top.depth++;
      else if (c === "}") {
        if (top.depth === 0 && stack.length > 1) stack.pop();
        else top.depth--;
      }
      code += c;
      masked += c;
      i++;
      if (!/\s/.test(c)) last = c;
    }
  }
  return { code, masked, strings };
}

/** The arguments of the call whose `(` just precedes `from`, as source text: nested calls stay whole. */
function callArgs(text: string, from: number): string[] {
  const args: string[] = [];
  let arg = "";
  let depth = 0;
  let quote: string | undefined;
  for (let i = from; i < text.length; i++) {
    const c = text[i]!;
    if (quote !== undefined) {
      arg += c;
      if (c === quote) quote = undefined;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;
      depth--;
    } else if (c === "," && depth === 0) {
      args.push(arg.trim());
      arg = "";
      continue;
    }
    arg += c;
  }
  args.push(arg.trim());
  return args;
}

/**
 * The path segments a `join(…)` or `resolve(…)` call names in a row: its literal arguments after
 * the base (which may be computed), up to the first computed one or glob. Past that the path is
 * data, and joining the literals around it would name a path the call never builds.
 */
function literalRun(args: string[]): string[] {
  const out: string[] = [];
  for (let i = LITERAL.test(args[0] ?? "") ? 0 : 1; i < args.length; i++) {
    const literal = LITERAL.exec(args[i]!)?.[2];
    if (literal === undefined) break;
    const parts = literal.split("/");
    const glob = parts.findIndex((p) => GLOB.test(p));
    out.push(...(glob < 0 ? parts : parts.slice(0, glob)));
    if (glob >= 0) break;
  }
  return out.filter((s) => s !== "");
}

/** Paths a package's files name inside other workspace packages, whether or not declared. */
export function reads(pkgs: Map<string, Pkg>): Read[] {
  const found = new Map<string, Read>();
  for (const file of git("ls-files", "-z").split("\0")) {
    const tsconfig = TSCONFIG.test(file);
    if (NOT_READERS.test(file) || !(tsconfig || READERS.test(file))) continue;
    const home = owner(pkgs, file);
    if (home === undefined) continue;
    const add = (at: string): void => {
      const path = relative(root, at).replaceAll("\\", "/");
      const target = owner(pkgs, `${path}/`);
      if (target !== undefined && target.name !== home.name)
        found.set(`${file}\0${path}`, { pkg: home.name, file, path, target: target.name });
    };
    const { code, masked, strings } = lex(readFileSync(join(root, file), "utf8"));
    if (tsconfig) {
      // A tsconfig's paths are relative to its own folder.
      for (const list of code.matchAll(TSCONFIG_LISTS))
        for (const m of list[1]!.matchAll(TSCONFIG_ESCAPE))
          add(resolve(root, dirname(file), m[1]!.replace(/\*.*$/, "")));
      continue;
    }
    // A literal is a path from its file, or from the package (a script's `at("../statistics/reference")`).
    // The file's reading wins when that path exists, then the package's; else the file's.
    for (const literal of strings) {
      const m = ESCAPE.exec(literal);
      if (m === null) continue;
      const fromFile = resolve(root, dirname(file), m[1]!);
      const fromPackage = resolve(root, home.dir, m[1]!);
      add(existsSync(fromFile) || !existsSync(fromPackage) ? fromFile : fromPackage);
    }
    // A package.json script runs from the package's folder: `node ../reference/scripts/x.ts`.
    if (file === `${home.dir}/package.json`) {
      const scripts = (JSON.parse(code) as { scripts?: Record<string, string> }).scripts ?? {};
      for (const script of Object.values(scripts))
        for (const m of script.matchAll(SCRIPT_ESCAPE)) add(resolve(root, home.dir, m[1]!));
    }
    // `join(…)` and `resolve(…)` take their segments one by one: the base is the file's folder, the
    // package's or the root, whichever holds the literal run after it.
    for (const call of masked.matchAll(PATH_CALL)) {
      const run = literalRun(callArgs(code, call.index + call[0].length));
      if (run.length === 0) continue;
      const rel = posix.join(...run);
      const bases = [resolve(root, dirname(file)), resolve(root, home.dir), root];
      const at = bases.map((base) => resolve(base, rel)).find((p) => existsSync(p));
      if (at !== undefined) add(at);
    }
  }
  return [...found.values()];
}

/** `@enumeratio/reference/node` reads every package's records; `@enumeratio/entry/node` does only
 *  through `recordDirs` and `packageDirs` (its other calls read or write one directory). */
const REFERENCE_NODE = /@enumeratio\/reference\/node/;
const ENTRY_NODE = /@enumeratio\/entry\/node/;
const WALKERS = /\b(?:recordDirs|packageDirs)\b/;
const walksRecords = (source: string): boolean => {
  const { code } = lex(source);
  return REFERENCE_NODE.test(code) || (ENTRY_NODE.test(code) && WALKERS.test(code));
};
/** A package's build scripts and tests, at any depth, plus its config (which may run either). */
const BUILD_OR_TEST = /^(?:(?:scripts|tests)\/.*|[^/]*config[^/]*)\.[cm]?[jt]s$/;
/** A build script running another package's script, which may walk the records itself. */
const SIBLING_SCRIPT = /(?:\.\.\/)+reference\/scripts\//;

/** Packages whose build scripts or tests walk every package's records, and the first file that does. */
export function scanners(pkgs: Map<string, Pkg>): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of git("ls-files", "-z").split("\0")) {
    const home = owner(pkgs, file);
    if (home === undefined || out.has(home.name)) continue;
    const rel = relative(home.dir, file);
    const script = BUILD_OR_TEST.test(rel) && walksRecords(readFileSync(join(root, file), "utf8"));
    const build = rel === "package.json" && SIBLING_SCRIPT.test(home.buildScript ?? "");
    if (script || build) out.set(home.name, file);
  }
  return out;
}

// The shapes of a walk over every package's sources, by what the code calls and not what it names
// its helpers: listing the packages and reading files, following imports through them
// (tools/static-imports.ts reads every package.json, then the sources an entry reaches), or
// listing a tree under `packages/`.
const LISTS_PACKAGES = /\b(?:packageDirs|loadWorkspace)\s*\(/;
const READS_FILES = /\b(?:readFileSync|readFile)\s*\(/;
const FOLLOWS_IMPORTS = /\b(?:pathsInto|workspaceEntries)\s*\(/;
const LISTS_TREE = /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/;
const UNDER_PACKAGES = /(?:^|\/)packages(?:\/|$)/;

function walksSources(source: string): boolean {
  const { masked, strings } = lex(source);
  return (
    FOLLOWS_IMPORTS.test(masked) ||
    (LISTS_PACKAGES.test(masked) && READS_FILES.test(masked)) ||
    (LISTS_TREE.test(masked) && strings.some((s) => UNDER_PACKAGES.test(s)))
  );
}

const TEST = /(?:^|\/)tests\/.*\.[cm]?[jt]s$|\.test\.[cm]?[jt]s$/;

/** The first file per package, among its tests or else its build scripts and config, that walks every package's sources. */
function sourceWalks(pkgs: Map<string, Pkg>, tests: boolean): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of git("ls-files", "-z").split("\0")) {
    const home = owner(pkgs, file);
    // The site (web/) has its own job, built from everything it reads.
    if (home === undefined || home.dir === "web" || out.has(home.name)) continue;
    const rel = relative(home.dir, file);
    if (tests ? !TEST.test(rel) : TEST.test(rel) || !BUILD_OR_TEST.test(rel)) continue;
    const text = readFileSync(join(root, file), "utf8");
    // A records walk is covered by `RECORDS`, whatever else it reads.
    if (walksSources(text) && (tests || !walksRecords(text))) out.set(home.name, file);
  }
  return out;
}

/** Packages whose tests walk every package's sources, and the first test that does. */
export const sourceScanners = (pkgs: Map<string, Pkg>): Map<string, string> => sourceWalks(pkgs, true);

/** Packages whose build scripts or config walk every package's sources (records aside), and the
 *  first file that does. Nothing can declare that: `SOURCES` is for tests, and a build's key leaves it out. */
export const buildSourceWalkers = (pkgs: Map<string, Pkg>): Map<string, string> => sourceWalks(pkgs, false);

/** Whether `read` is covered by a dependency or by `enumeratio.reads`. `deps`, not only what
 *  package.json declares: the key hashes each dependency's key, and a build script running a
 *  sibling's script (`node ../reference/scripts/x.ts`) makes that sibling one. */
export function declared(pkgs: Map<string, Pkg>, read: Read): boolean {
  const p = pkgs.get(read.pkg)!;
  if (p.deps.has(read.target)) return true;
  return p.reads.some((r) => {
    if (r === RECORDS) return RECORD_PATH.test(read.path);
    return r !== SOURCES && (read.path === r || read.path.startsWith(`${r}/`));
  });
}
