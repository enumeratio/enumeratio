// What a name is, with no engine: the manifest's overloads, parameters and attributes, the
// summary and example count from a documenting package's module (imported on first use), and
// for `ns.Name` the registry's index. compute-engine's `About` reports this for a name the
// engine hasn't declared, the REPL prints it for `?Name`, and nothing is declared to answer it.

import { PACKAGE_MODULES, type PackageModule } from "./generated/package-modules.ts";
import { SYMBOLS } from "./generated/symbols.ts";
import type { Registry } from "./registry.ts";
import type { Description, Overload, SymbolInfo } from "./types.ts";

const ENGINE = "compute-engine";
const SITE = "https://enumeratio.dev/reference/symbol/";

const loaded = new Map<string, PackageModule>();

async function packageModule(pkg: string): Promise<PackageModule | undefined> {
  const found = loaded.get(pkg);
  if (found !== undefined) return found;
  const load = Object.hasOwn(PACKAGE_MODULES, pkg) ? PACKAGE_MODULES[pkg] : undefined;
  if (load === undefined) return undefined;
  const module = await load();
  loaded.set(pkg, module);
  return module;
}

/** Import every package's summaries, so `describeNow` has them all: for a host that answers
 *  synchronously (the REPL's `?Name`). */
export async function loadSummaries(): Promise<void> {
  await Promise.all(Object.keys(PACKAGE_MODULES).map(packageModule));
}

/**
 * The signature a head is declared with once every package is in: of the overloads no package
 * filters (`on`, `symbols`, `types`), one no other replaces (`overrides`), the widest of those.
 */
export function winningOverload(overloads: readonly Overload[]): Overload | undefined {
  const general = overloads.filter((o) => o.on === undefined && o.symbols === undefined && o.types === undefined);
  const replaced = new Set(general.flatMap((o) => (o.overrides === undefined ? [] : [o.overrides])));
  const standing = general.filter((o) => !replaced.has(o.package) && o.type !== undefined);
  return standing.at(-1) ?? general.at(-1) ?? overloads.at(-1);
}

const isSignature = (type: string | undefined): boolean => type?.startsWith("(") === true;

/** What the manifest alone says of `info`, with the summary and count where already loaded. */
function fromManifest(info: SymbolInfo): Description {
  const winner = winningOverload(info.overloads);
  const type = winner?.type;
  const constant = info.overloads.every((o) => o.package === ENGINE) && !isSignature(type);
  const pkg = info.documented[0];
  const module = pkg === undefined ? undefined : loaded.get(pkg);
  const summary = module?.SUMMARIES[info.name];
  const examples = module?.EXAMPLES?.[info.name];
  return {
    name: info.name,
    kind: isSignature(type) ? "function" : constant && type !== undefined ? "constant" : "symbol",
    ...(summary === undefined ? {} : { description: summary }),
    ...(info.documented.length > 0 ? { url: `${SITE}${info.name}` } : {}),
    ...(isSignature(type) ? { signature: type } : type === undefined ? {} : { type }),
    overloads: info.overloads,
    ...(info.params === undefined ? {} : { params: info.params }),
    ...(info.attributes === undefined ? {} : { attributes: info.attributes }),
    documented: info.documented,
    ...(info.findstat === undefined ? {} : { findstat: info.findstat }),
    ...(examples === undefined ? {} : { examples }),
  };
}

/** A glob over names: `*` is any run of characters. */
const globOf = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "u");

export interface DescribeOptions {
  /** Where a library's `ns.Name` is described (`Registry.describe`). Our packages' `Pkg.Head`
   *  needs none. */
  readonly registry?: Registry<never>;
}

/**
 * `name`'s description, from what is already loaded: the manifest, and the summaries a
 * `describe` call has imported. Never imports or fetches: a library's `ns.Name` is described
 * only where a resolver noted it on `engine` (`noteDescription`).
 */
export function describeNow(name: string, engine?: object): Description {
  const noted = engine === undefined ? undefined : describedIn(engine, name);
  if (noted !== undefined) return noted;
  if (name.includes(".")) return describeMember(name) ?? { name, kind: "unknown" };
  const info = Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
  return info === undefined ? { name, kind: "unknown" } : fromManifest(info);
}

/** A package's namespace: `number-theory` is `NumberTheory`. */
export const namespaceOf = (pkg: string): string =>
  pkg.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, c: string) => c.toUpperCase());

/** `Pkg.Head`, where `Pkg` is the namespace of a package that gives `Head` an overload: the
 *  global head, by that name. Undefined for any other qualified name. */
function describeMember(name: string): Description | undefined {
  const [namespace, member, ...rest] = name.split(".");
  if (member === undefined || rest.length > 0) return undefined;
  const info = Object.hasOwn(SYMBOLS, member) ? SYMBOLS[member] : undefined;
  if (info === undefined || !info.overloads.some((o) => o.package !== ENGINE && namespaceOf(o.package) === namespace))
    return undefined;
  return { ...fromManifest(info), name, namespace: namespace! };
}

/**
 * What `name` is: a head we know (`Zeta`), a library symbol (`ada.Sq`, through `registry`), or
 * `unknown`. A name with `*` is a glob over the manifest's heads (and, for `ns.*`, the names
 * `ns` offers), described in name order.
 */
export function describe(pattern: `${string}*${string}`, options?: DescribeOptions): Promise<Description[]>;
export function describe(name: string, options?: DescribeOptions): Promise<Description>;
export async function describe(name: string, options: DescribeOptions = {}): Promise<Description | Description[]> {
  if (name.includes("*")) return describeMatching(name, options);
  const { registry } = options;
  if (name.includes(".")) {
    const served = await registry?.describe?.(name);
    if (served !== undefined) return served;
    const member = name.slice(name.lastIndexOf(".") + 1);
    const pkg = Object.hasOwn(SYMBOLS, member) ? SYMBOLS[member]!.documented[0] : undefined;
    if (pkg !== undefined) await packageModule(pkg);
    return describeMember(name) ?? { name, kind: "unknown" };
  }
  const info = Object.hasOwn(SYMBOLS, name) ? SYMBOLS[name] : undefined;
  if (info === undefined) return { name, kind: "unknown" };
  if (info.documented[0] !== undefined) await packageModule(info.documented[0]);
  return fromManifest(info);
}

async function describeMatching(pattern: string, options: DescribeOptions): Promise<Description[]> {
  const dot = pattern.lastIndexOf(".");
  if (dot > 0) {
    const namespace = pattern.slice(0, dot);
    const matches = globOf(pattern.slice(dot + 1));
    const names = (await options.registry?.names?.(namespace)) ?? [];
    const found = names.filter((n) => matches.test(n)).toSorted();
    return Promise.all(found.map((n) => describe(`${namespace}.${n}`, options)));
  }
  return Promise.all(matching(pattern).map((n) => describe(n, options)));
}

/** The manifest's heads a glob matches (`Zeta*`), in name order. */
export function matching(pattern: string): string[] {
  const matches = globOf(pattern);
  return Object.keys(SYMBOLS).filter((n) => matches.test(n));
}

const noted = new WeakMap<object, Map<string, Description>>();

/** Remember `description` for `engine`, for a head that reads it synchronously (`describedIn`). */
export function noteDescription(engine: object, description: Description): void {
  const table = noted.get(engine) ?? new Map<string, Description>();
  table.set(description.name, description);
  noted.set(engine, table);
}

/** What was described for `engine` under `name`, by a resolver's `describeOnly`. */
export function describedIn(engine: object, name: string): Description | undefined {
  return noted.get(engine)?.get(name);
}
