// Assemble the manifest (https://github.com/enumeratio/enumeratio/wiki/Manifest) into src/generated/, which `vp pack` then
// builds into dist/. Reads every package's records and a bare compute-engine; loads no
// package's code, so it sits at the bottom of the build graph.
//
//   node packages/manifest/scripts/build.ts

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import type { ReferenceEntry } from "@enumeratio/entry";
import { headNames, INDEX_FILE, parseIndex, recordDirs } from "@enumeratio/entry/node";
import { canonicalOrder } from "../src/canonical.ts";
import type { DeclaredSymbol, FindStatId, Overload, SymbolAttribute, SymbolInfo } from "../src/types.ts";

const PACKAGES = fileURLToPath(new URL("../../", import.meta.url));
const OUT = fileURLToPath(new URL("../src/generated/", import.meta.url));
const ENGINE = "compute-engine";

type Record_ = Omit<ReferenceEntry, "examples">;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** A signature row's `library`, as the package it names: `enumeratio-boxes` and
 *  `@enumeratio/boxes` are both `boxes`; absent is the engine's own. */
export const packageOf = (library: string | undefined): string =>
  library === undefined ? ENGINE : library.replace(/^@enumeratio\//, "").replace(/^enumeratio-/, "");

/** `SetMinus(a, b)` -> `["a", "b"]`, for a fixed arity spelled with plain names. */
function paramsOf(signature: string): string[] | undefined {
  const m = /^\w+\((.*)\)$/.exec(signature.trim());
  if (!m || m[1].includes("…") || m[1].includes("...")) return undefined;
  const list = m[1]
    .split(",")
    .map((p) => p.trim().replace(/\?$/, ""))
    .filter((p) => p.length > 0);
  return list.length > 0 && list.every((p) => /^[a-z][A-Za-z0-9]*$/.test(p)) ? list : undefined;
}

// --- the records ------------------------------------------------------------------------

const records: { package: string; record: Record_ }[] = [];
for (const { package: pkg, dir } of recordDirs(PACKAGES)) {
  for (const head of headNames(dir).toSorted(cmp)) {
    records.push({
      package: pkg,
      record: parseIndex(readFileSync(join(dir, head, INDEX_FILE), "utf8")).fields as Record_,
    });
  }
}

// --- which of our packages each one needs ------------------------------------------------

/** Every workspace package's `@enumeratio/*` runtime dependencies, by package name. */
function packageRequires(): Record<string, string[]> {
  const dirs = [
    ...readdirSync(PACKAGES).map((name) => join(PACKAGES, name)),
    ...readdirSync(join(PACKAGES, "symbols")).flatMap((group) =>
      readdirSync(join(PACKAGES, "symbols", group)).map((name) => join(PACKAGES, "symbols", group, name)),
    ),
  ];
  const requires: Record<string, string[]> = {};
  for (const dir of dirs) {
    const file = join(dir, "package.json");
    if (!existsSync(file)) continue;
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { name?: string; dependencies?: Record<string, string> };
    if (!pkg.name?.startsWith("@enumeratio/")) continue;
    requires[packageOf(pkg.name)] = Object.keys(pkg.dependencies ?? {})
      .filter((dep) => dep.startsWith("@enumeratio/"))
      .map(packageOf)
      .toSorted(cmp);
  }
  return requires;
}

// --- the engine's own heads -------------------------------------------------------------

interface Scope {
  readonly bindings: Map<string, unknown>;
  readonly parent?: Scope;
}

function engineTypes(): Map<string, string> {
  const ce = new ComputeEngine();
  const names = new Set<string>();
  let scope: Scope | undefined = (ce as unknown as { context: { lexicalScope: Scope } }).context.lexicalScope;
  for (; scope !== undefined; scope = scope.parent) for (const name of scope.bindings.keys()) names.add(name);
  const types = new Map<string, string>();
  for (const name of names) {
    if (!/^[A-Z]/.test(name)) continue;
    const found = ce.lookupDefinition(name) as
      | { operator?: { signature?: unknown }; value?: { type?: unknown } }
      | undefined;
    const type = found?.operator?.signature ?? found?.value?.type;
    if (type !== undefined) types.set(name, `${type as string}`);
  }
  return types;
}

// --- assembling -------------------------------------------------------------------------

const byName = new Map<
  string,
  {
    documented: string[];
    overloads: Overload[];
    params?: string[];
    attributes: Set<SymbolAttribute>;
    findstat: Map<string, FindStatId>;
  }
>();
const entry = (name: string) => {
  let info = byName.get(name);
  if (info === undefined)
    byName.set(name, (info = { documented: [], overloads: [], attributes: new Set(), findstat: new Map() }));
  return info;
};

for (const [name, type] of engineTypes()) entry(name).overloads.push({ package: ENGINE, type });

// reference's own copy of a head is the canonical one (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §9), so
// its signature spells the parameter names when it has one.
const ranked = [...records].toSorted((a, b) =>
  cmp(a.package === "reference" ? "0" : "1", b.package === "reference" ? "0" : "1"),
);
for (const { package: pkg, record } of ranked) {
  const info = entry(record.name);
  info.documented.push(pkg);
  info.params ??= paramsOf(record.signature);
  for (const attribute of record.attributes ?? []) info.attributes.add(attribute);
  for (const row of [...(record.references ?? []), ...(record.catalog ?? [])])
    if (row.system === "findstat")
      info.findstat.set(`${row.identity}@${row.on ?? ""}`, {
        id: row.identity,
        ...(row.on !== undefined ? { on: row.on } : {}),
      });
  for (const row of record.signatures ?? []) {
    const from = packageOf(row.library);
    if (from === ENGINE) continue; // the engine's overload already came from the engine
    const same = info.overloads.find((o) => o.package === from && o.type === row.type);
    const untyped = info.overloads.find((o) => o.package === from && o.type === undefined);
    if (same !== undefined) continue;
    if (untyped !== undefined && row.type !== undefined) info.overloads.splice(info.overloads.indexOf(untyped), 1);
    else if (row.type === undefined && info.overloads.some((o) => o.package === from)) continue;
    info.overloads.push({
      package: from,
      ...(row.type !== undefined ? { type: row.type } : {}),
      ...(row.overrides !== undefined ? { overrides: packageOf(row.overrides) } : {}),
    });
  }
}

// A head's overloads in canonical order (src/canonical.ts), typed against a bare engine.
const typing = new ComputeEngine();

const symbols: Record<string, SymbolInfo> = {};
for (const name of [...byName.keys()].toSorted(cmp)) {
  const info = byName.get(name)!;
  symbols[name] = {
    name,
    documented: info.documented.toSorted(cmp),
    overloads: canonicalOrder(info.overloads, typing),
    ...(info.params !== undefined ? { params: info.params } : {}),
    ...(info.attributes.size > 0 ? { attributes: [...info.attributes].toSorted(cmp) } : {}),
    ...(info.findstat.size > 0
      ? { findstat: [...info.findstat.keys()].toSorted(cmp).map((key) => info.findstat.get(key)!) }
      : {}),
  };
}

// What each package's `declare` reads: its records' summaries, and its own typed overload.
const perPackage = new Map<string, Record<string, DeclaredSymbol>>();
for (const { package: pkg, record } of records) {
  const own = (record.signatures ?? []).filter((row) => packageOf(row.library) === pkg && row.type !== undefined);
  const types = new Set(own.map((row) => row.type));
  if (types.size > 1) {
    // One declared signature per head until dispatch can combine overloads (https://github.com/enumeratio/enumeratio/wiki/Manifest).
    throw new Error(`manifest: ${pkg} gives ${record.name} ${types.size} types; one per package for now`);
  }
  const declared: DeclaredSymbol = {
    summary: record.summary,
    ...(own[0]?.type !== undefined ? { type: own[0].type } : {}),
    ...(record.attributes !== undefined ? { attributes: record.attributes } : {}),
  };
  const table = perPackage.get(pkg) ?? {};
  table[record.name] = declared;
  perPackage.set(pkg, table);
}

// --- writing ----------------------------------------------------------------------------

const HEADER = "// GENERATED by packages/manifest/scripts/build.ts at build time; never committed.\n\n";
const sorted = <T>(table: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.keys(table)
      .toSorted(cmp)
      .map((k) => [k, table[k]]),
  );

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "package"), { recursive: true });
writeFileSync(
  join(OUT, "symbols.ts"),
  `${HEADER}import type { SymbolInfo } from "../types.ts";\n\nexport const SYMBOLS: Readonly<Record<string, SymbolInfo>> = ${JSON.stringify(symbols)};\n`,
);
const requires = sorted(packageRequires());
writeFileSync(
  join(OUT, "packages.ts"),
  `${HEADER}/** Each of our packages' own \`@enumeratio/*\` runtime dependencies, by package name. */
export const PACKAGES: Readonly<Record<string, { readonly requires: readonly string[] }>> = ${JSON.stringify(
    Object.fromEntries(Object.entries(requires).map(([name, deps]) => [name, { requires: deps }])),
  )};
`,
);
for (const [pkg, table] of [...perPackage].toSorted(([a], [b]) => cmp(a, b))) {
  const declared = sorted(table);
  const summaries = Object.fromEntries(Object.entries(declared).map(([k, v]) => [k, v.summary]));
  writeFileSync(
    join(OUT, "package", `${pkg}.ts`),
    `${HEADER}import type { DeclaredSymbol } from "../../types.ts";

/** What \`${pkg}\`'s declare reads for each head it documents. */
export const SYMBOLS: Readonly<Record<string, DeclaredSymbol>> = ${JSON.stringify(declared)};

/** Each head's record \`summary\`, for its \`description\`. */
export const SUMMARIES: Readonly<Record<string, string>> = ${JSON.stringify(summaries)};
`,
  );
}

console.log(`manifest: ${Object.keys(symbols).length} heads, ${perPackage.size} packages -> ${OUT}`);
