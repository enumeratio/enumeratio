// Version ranges to exact versions (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2):
// a host asks for symbol packages by range, as npm does, and gets the exact versions
// `npmRegistry` reads, closed over the symbol packages they depend on. A lock keeps what was
// chosen: a locked version stays while every range asking for it still admits it, so a page
// means at run time what it meant when it was locked.

import { maxSatisfying, satisfies, validRange } from "semver";
import { type FetchJson, fetchJson, type SymbolPackageField } from "./npm-registry.ts";

/** The exact version chosen for each package, by name. */
export type PackageLock = Readonly<Record<string, string>>;

/** Every published version of a package. */
export type ListVersions = (name: string) => Promise<readonly string[]>;

/** jsDelivr's list of a package's versions. */
export const jsdelivrVersions =
  (fetch: FetchJson = fetchJson): ListVersions =>
  async (name) => {
    const data = (await fetch(`https://data.jsdelivr.com/v1/packages/npm/${name}`)) as {
      versions: readonly { version: string }[];
    };
    return data.versions.map((v) => v.version);
  };

export interface LockOptions {
  /** What was chosen before: kept where every range still admits it. */
  readonly lock?: PackageLock;
  readonly listVersions?: ListVersions;
  /** Where a package version's files are: jsDelivr's npm mirror by default. */
  readonly cdn?: string;
  readonly fetch?: FetchJson;
}

/** `@ada/primes@^1.0.0` as its name and range. */
function parseWanted(spec: string): { name: string; range: string } {
  const at = spec.lastIndexOf("@");
  if (at <= 0) return { name: spec, range: "*" };
  return { name: spec.slice(0, at), range: spec.slice(at + 1) };
}

/**
 * Exact versions for `wanted` (`name@range`), and for every symbol package they depend on,
 * transitively: a dependency is a symbol package when its `package.json` has an `enumeratio`
 * field. One version per package, the highest every range asking for it admits; a range
 * nothing satisfies, or two ranges no one version meets, throws, naming them.
 */
export async function lockPackages(wanted: readonly string[], options: LockOptions = {}): Promise<PackageLock> {
  const { lock = {}, cdn = "https://cdn.jsdelivr.net/npm", fetch = fetchJson } = options;
  const listVersions = options.listVersions ?? jsdelivrVersions(fetch);
  const versionLists = new Map<string, Promise<readonly string[]>>();
  const versionsOf = (name: string): Promise<readonly string[]> => {
    let list = versionLists.get(name);
    if (list === undefined) {
      list = listVersions(name);
      versionLists.set(name, list);
    }
    return list;
  };
  const highest = async (name: string, range: string): Promise<string | null> =>
    maxSatisfying([...(await versionsOf(name))], range);

  type Ask = { readonly name: string; readonly range: string; readonly by: string };
  const host: Ask[] = wanted.map((spec) => ({ ...parseWanted(spec), by: "the host" }));
  // What each package version asks of the symbol packages it depends on, read once.
  const asksOf = new Map<string, Promise<Ask[]>>();
  const dependencyAsks = (name: string, version: string): Promise<Ask[]> => {
    const key = `${name}@${version}`;
    let found = asksOf.get(key);
    if (found === undefined) {
      found = (async () => {
        const pkg = (await fetch(`${cdn}/${key}/package.json`)) as {
          enumeratio?: SymbolPackageField;
          dependencies?: Record<string, string>;
        };
        if (pkg.enumeratio === undefined) throw new Error(`${key} isn't a symbol package`);
        const asks: Ask[] = [];
        for (const [dependency, range] of Object.entries(pkg.dependencies ?? {})) {
          // Any version in range tells whether it's a symbol package: the locked one if it is.
          const locked = lock[dependency];
          const any = locked !== undefined && satisfies(locked, range) ? locked : await highest(dependency, range);
          if (any === null) throw new Error(`no version of ${dependency} satisfies ${range} (${key})`);
          const dependencyPkg = (await fetch(`${cdn}/${dependency}@${any}/package.json`)) as { enumeratio?: unknown };
          if (dependencyPkg.enumeratio !== undefined) asks.push({ name: dependency, range, by: key });
        }
        return asks;
      })();
      asksOf.set(key, found);
    }
    return found;
  };

  // Until the choice settles: the host's asks and those of the versions chosen, then the
  // highest version each package's asks all admit (a locked one while they still do).
  let chosen = new Map<string, string>();
  for (let round = 0; ; round++) {
    if (round > MAX_ROUNDS) throw new Error("lockPackages: the choice doesn't settle");
    const asks = [...host];
    for (const [name, version] of chosen) asks.push(...(await dependencyAsks(name, version)));
    const byName = new Map<string, Ask[]>();
    for (const ask of asks) {
      if (validRange(ask.range) === null)
        throw new Error(`${ask.by} asks for ${ask.name}@${ask.range}, which isn't a version range`);
      byName.set(ask.name, [...(byName.get(ask.name) ?? []), ask]);
    }
    const next = new Map<string, string>();
    for (const [name, asked] of byName) {
      const locked = lock[name];
      if (locked !== undefined && asked.every(({ range }) => satisfies(locked, range))) {
        next.set(name, locked);
        continue;
      }
      const found = await highest(name, asked.map(({ range }) => range).join(" "));
      if (found === null)
        throw new Error(
          `no version of ${name} satisfies ${asked.map(({ range, by }) => `${range} (${by})`).join(", ")}`,
        );
      next.set(name, found);
    }
    const settled = next.size === chosen.size && [...next].every(([name, version]) => chosen.get(name) === version);
    chosen = next;
    if (settled) break;
  }
  return Object.fromEntries([...chosen].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** A cap on the rounds a choice takes to settle: each round only adds what chosen versions ask. */
const MAX_ROUNDS = 64;

/** A lock as the specs `npmRegistry` takes: `name@version`. */
export const specsOf = (lock: PackageLock): string[] =>
  Object.entries(lock).map(([name, version]) => `${name}@${version}`);
