// A registry served by npm (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2): npm is the
// transport, the symbol index is ours. A package marks itself in `package.json`:
//
//   "enumeratio": { "namespace": "ada", "index": "./symbols/index.json", "system": ">=0.1" }
//
// and ships `symbols/<Name>/definition.json` (signature, body, requires) beside the index,
// which `symbolIndexOf` builds at pack time, with `examples.json` from the symbol's record
// (`index.md`, `examples.tsv`, as ours are) for the install check. A version is read over a CDN (jsDelivr by
// default), so a page fetches one small index per namespace and then only the definitions an
// expression uses. Every definition is checked against its pin before it is used.

import { satisfies, validRange } from "semver";
import { type Definition, type Example, pinnedHead, pinOf, type Registry } from "./registry.ts";
import { SYSTEM_VERSION } from "./system.ts";

/** The `enumeratio` field of a symbol package's `package.json`. */
export interface SymbolPackageField {
  /** Its namespace: a scoped package's must be its scope's name. */
  readonly namespace: string;
  /** Its index, relative to the package root. */
  readonly index: string;
  /** The range of the system its definitions were written against. */
  readonly system?: string;
}

/**
 * Whether a package's `system` range admits the system's version. A package that states none
 * is taken at its word that it needs nothing in particular; one that states a range that isn't
 * one admits nothing.
 */
export const admitsSystem = (field: SymbolPackageField, system: string = SYSTEM_VERSION): boolean =>
  field.system === undefined || (validRange(field.system) !== null && satisfies(system, field.system));

/** `symbols/index.json`: each name's signature, pin and pinned dependencies. */
export interface SymbolIndex {
  readonly namespace: string;
  readonly symbols: Readonly<
    Record<
      string,
      {
        readonly signature: string;
        readonly pin: string;
        readonly requires?: Readonly<Record<string, string>>;
        /** How many examples `<Name>/examples.json` holds, for the install check. */
        readonly examples?: number;
      }
    >
  >;
}

/** A package's index, from its definitions: what packing writes to `symbols/index.json`. */
export async function symbolIndexOf(
  namespace: string,
  definitions: Readonly<Record<string, Definition>>,
): Promise<SymbolIndex> {
  const symbols: Record<string, SymbolIndex["symbols"][string]> = {};
  for (const name of Object.keys(definitions).toSorted()) {
    const definition = definitions[name]!;
    symbols[name] = {
      signature: definition.signature,
      pin: await pinOf(definition),
      ...(definition.requires === undefined ? {} : { requires: definition.requires }),
      ...(definition.examples?.length ? { examples: definition.examples.length } : {}),
    };
  }
  return { namespace, symbols };
}

/** Reads a URL as JSON; `fetch` by default, anything else in a test or a build cache. */
export type FetchJson = (url: string) => Promise<unknown>;

/** `fetch`, as JSON. */
export const fetchJson: FetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
};

export interface NpmRegistryOptions {
  /** The system's version, which each package's `system` range must admit: ours by default. */
  readonly system?: string;
  /** Where a package version's files are: jsDelivr's npm mirror by default. */
  readonly cdn?: string;
  readonly fetch?: FetchJson;
}

/** `@ada/primes@1.2.0` as its name and version; a version is required, since a pin needs one. */
function parseSpec(spec: string): { name: string; version: string } {
  const at = spec.lastIndexOf("@");
  if (at <= 0) throw new Error(`npm registry: ${spec} needs a version (name@version)`);
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

/**
 * Symbol packages on npm as a registry, one exact version each: `@ada/primes@1.2.0` serves
 * the namespace its `package.json` names, which for a scoped package must be the scope's. A
 * definition whose content doesn't hash to its index's pin (or the pin asked for) isn't
 * served. Files are read once per registry.
 */
export function npmRegistry<Engine extends object>(
  specs: readonly string[],
  { cdn = "https://cdn.jsdelivr.net/npm", fetch = fetchJson, system = SYSTEM_VERSION }: NpmRegistryOptions = {},
): Registry<Engine> {
  const packages = specs.map(parseSpec);
  const cache = new Map<string, Promise<unknown>>();
  const read = (url: string): Promise<unknown> => {
    let found = cache.get(url);
    if (found === undefined) {
      found = fetch(url);
      cache.set(url, found);
    }
    return found;
  };

  interface Opened {
    readonly root: string;
    readonly index: SymbolIndex;
  }
  let opened: Promise<Map<string, Opened>> | undefined;
  const open = (): Promise<Map<string, Opened>> =>
    (opened ??= (async () => {
      const byNamespace = new Map<string, Opened>();
      for (const { name, version } of packages) {
        const spec = `${name}@${version}`;
        const root = `${cdn}/${name}@${version}`;
        const pkg = (await read(`${root}/package.json`)) as { enumeratio?: SymbolPackageField };
        const field = pkg.enumeratio;
        if (field === undefined) throw new Error(`npm registry: ${spec} has no "enumeratio" field`);
        if (!admitsSystem(field, system))
          throw new Error(`npm registry: ${spec} is for the system ${field.system}, not ${system}`);
        const scope = name.startsWith("@") ? name.slice(1, name.indexOf("/")) : undefined;
        if (scope !== undefined && field.namespace !== scope)
          throw new Error(`npm registry: ${spec} claims the namespace ${field.namespace}, not its scope ${scope}`);
        if (byNamespace.has(field.namespace))
          throw new Error(`npm registry: two packages serve the namespace ${field.namespace}`);
        const index = (await read(`${root}/${field.index.replace(/^\.\//, "")}`)) as SymbolIndex;
        const indexDir = field.index.replace(/^\.\//, "").replace(/[^/]*$/, "");
        byNamespace.set(field.namespace, { root: `${root}/${indexDir}`, index });
      }
      return byNamespace;
    })());

  return {
    async names(namespace) {
      const found = (await open()).get(namespace);
      return found === undefined ? undefined : Object.keys(found.index.symbols);
    },
    async resolve(name, pin) {
      const [namespace, member, ...rest] = name.split(".");
      if (member === undefined || rest.length > 0) return undefined;
      const found = (await open()).get(namespace!);
      const entry = found?.index.symbols[member];
      if (found === undefined || entry === undefined || (pin !== undefined && pin !== entry.pin)) return undefined;
      const definition = (await read(`${found.root}${member}/definition.json`)) as Definition;
      if ((await pinOf(definition)) !== entry.pin) return undefined;
      const examples = entry.examples
        ? async () => (await read(`${found.root}${member}/examples.json`)) as readonly Example[]
        : undefined;
      return {
        head: pinnedHead(namespace!, member, entry.pin),
        definition,
        pin: entry.pin,
        ...(examples === undefined ? {} : { examples }),
      };
    },
  };
}
