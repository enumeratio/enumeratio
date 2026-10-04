// What a module loads before any of its code runs: its static value imports, followed through
// the workspace's sources (an `@enumeratio/…` specifier resolves to its package's source, as
// the site's aliases do). Type-only imports and `import()` are not followed, nor a VitePress
// data loader (`*.data.ts`), which the page gets as its data.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

function packageDirs(): string[] {
  const packages = join(ROOT, "packages");
  return [
    ...readdirSync(packages).map((name) => join(packages, name)),
    ...readdirSync(join(packages, "symbols")).flatMap((group) =>
      readdirSync(join(packages, "symbols", group)).map((name) => join(packages, "symbols", group, name)),
    ),
  ];
}

let specifiers: Map<string, string> | undefined;

/** Each `@enumeratio/…` entry point's source file. */
function workspaceEntries(): Map<string, string> {
  if (specifiers) return specifiers;
  specifiers = new Map();
  for (const dir of packageDirs()) {
    const manifest = join(dir, "package.json");
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string; exports?: Record<string, unknown> };
    if (!pkg.name?.startsWith("@enumeratio/") || !pkg.exports) continue;
    for (const [sub, entry] of Object.entries(pkg.exports)) {
      const target = typeof entry === "string" ? entry : (entry as { import?: string } | null)?.import;
      if (typeof target !== "string") continue;
      const source = target.includes("/dist/")
        ? target.replace("/dist/", "/src/").replace(/\.(m|c)?js$/, ".ts")
        : /\.[cm]?ts$/.test(target)
          ? target
          : undefined;
      if (source === undefined || !existsSync(join(dir, source))) continue;
      specifiers.set(sub === "." ? pkg.name : pkg.name + sub.slice(1), join(dir, source));
    }
  }
  return specifiers;
}

// `import … from`, `export … from` and bare `import "…"`, with the clause kept so a type-only
// one can be told apart. Comments are stripped first.
const STATIC = /(?:^|[;\n])\s*(import|export)\s+(?:([^;"'`=()]*?)\s*from\s*)?["']([^"']+)["']/g;

function typeOnly(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const named = /^\{([^}]*)\}$/.exec(clause.trim());
  if (named === null) return false;
  const names = named[1]!
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((n) => n.startsWith("type "));
}

function resolveFile(from: string, specifier: string): string | undefined {
  if (specifier.startsWith(".")) {
    const base = resolve(dirname(from), specifier);
    for (const candidate of [base, `${base}.ts`, join(base, "index.ts")])
      if (existsSync(candidate) && /\.([cm]?[jt]s|vue)$/.test(candidate)) return candidate;
    return undefined;
  }
  return workspaceEntries().get(specifier);
}

/**
 * Every module `entry` loads statically, each with the chain that reaches it. External
 * packages appear by specifier and aren't followed.
 */
export function staticGraph(entry: string): Map<string, readonly string[]> {
  const reached = new Map<string, readonly string[]>([[entry, [entry]]]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    const text = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
    for (const [, , clause, specifier] of text.matchAll(STATIC)) {
      if (clause !== undefined && typeOnly(clause)) continue;
      const target = resolveFile(file, specifier!) ?? (specifier!.startsWith(".") ? undefined : specifier!);
      if (target === undefined || reached.has(target) || target.endsWith(".data.ts")) continue;
      reached.set(target, [...reached.get(file)!, target]);
      if (target.startsWith("/")) queue.push(target);
    }
  }
  return reached;
}

/** The chains from `entry` into any module `forbidden` matches, one per first entry. */
export function pathsInto(entry: string, forbidden: RegExp): string[] {
  const out = new Set<string>();
  for (const [target, chain] of staticGraph(entry)) {
    if (!forbidden.test(target)) continue;
    const first = chain.findIndex((m) => forbidden.test(m));
    out.add(
      chain
        .slice(0, first + 1)
        .map((m) => m.replace(ROOT, ""))
        .join(" -> "),
    );
  }
  return [...out].toSorted();
}

export const PACKAGE_ROOT = ROOT;
