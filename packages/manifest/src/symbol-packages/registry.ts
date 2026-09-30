// Symbol packages as a registry (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2): one
// exact version each, read from a host (npm by default), so a page fetches one small index per
// namespace and then only the definitions an expression uses. Every definition is checked
// against its pin before it is used.

import { type Definition, type Example, pinnedHead, pinOf, type Registry } from "../registry.ts";
import { SYSTEM_VERSION } from "../system.ts";
import { admitsSystem, type SymbolIndex, type SymbolPackageField } from "./format.ts";
import { npmHost, type PackageHost } from "./host.ts";

export interface PackageRegistryOptions {
  /** Where the packages come from: npm, over jsDelivr, by default. */
  readonly host?: PackageHost;
  /** The system's version, which each package's `system` range must admit: ours by default. */
  readonly system?: string;
}

/** `@ada/primes@1.2.0` as its name and version; a version is required, since a pin needs one. */
function parseSpec(spec: string): { name: string; version: string } {
  const at = spec.lastIndexOf("@");
  if (at <= 0) throw new Error(`package registry: ${spec} needs a version (name@version)`);
  return { name: spec.slice(0, at), version: spec.slice(at + 1) };
}

/**
 * Symbol packages as a registry, one exact version each: `@ada/primes@1.2.0` serves the
 * namespace its `package.json` names, which must be the one its name reserves on the host (npm's
 * scope, GitHub's owner). A definition whose content doesn't hash to its index's pin (or the
 * pin asked for) isn't served. Files are read once per registry.
 */
export function packageRegistry<Engine extends object>(
  specs: readonly string[],
  { host = npmHost(), system = SYSTEM_VERSION }: PackageRegistryOptions = {},
): Registry<Engine> {
  const packages = specs.map(parseSpec);
  const cache = new Map<string, Promise<unknown>>();
  const read = (name: string, version: string, path: string): Promise<unknown> => {
    const key = `${name}@${version}/${path}`;
    let found = cache.get(key);
    if (found === undefined) {
      found = host.file(name, version, path);
      cache.set(key, found);
    }
    return found;
  };

  interface Opened {
    readonly name: string;
    readonly version: string;
    /** The index's folder, relative to the package root. */
    readonly dir: string;
    readonly index: SymbolIndex;
  }
  let opened: Promise<Map<string, Opened>> | undefined;
  const open = (): Promise<Map<string, Opened>> =>
    (opened ??= (async () => {
      const byNamespace = new Map<string, Opened>();
      for (const { name, version } of packages) {
        const spec = `${name}@${version}`;
        const pkg = (await read(name, version, "package.json")) as { enumeratio?: SymbolPackageField };
        const field = pkg.enumeratio;
        if (field === undefined) throw new Error(`package registry: ${spec} has no "enumeratio" field`);
        if (!admitsSystem(field, system))
          throw new Error(`package registry: ${spec} is for the system ${field.system}, not ${system}`);
        const owner = host.owner(name);
        if (owner !== undefined && field.namespace !== owner)
          throw new Error(`package registry: ${spec} claims the namespace ${field.namespace}, not ${owner}`);
        if (byNamespace.has(field.namespace))
          throw new Error(`package registry: two packages serve the namespace ${field.namespace}`);
        const indexPath = field.index.replace(/^\.\//, "");
        const index = (await read(name, version, indexPath)) as SymbolIndex;
        byNamespace.set(field.namespace, { name, version, dir: indexPath.replace(/[^/]*$/, ""), index });
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
      const definition = (await read(found.name, found.version, `${found.dir}${member}/definition.json`)) as Definition;
      if ((await pinOf(definition)) !== entry.pin) return undefined;
      const examples = entry.examples
        ? async () =>
            (await read(found.name, found.version, `${found.dir}${member}/examples.json`)) as readonly Example[]
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
