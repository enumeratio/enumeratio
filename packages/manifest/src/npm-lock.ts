// Version ranges to exact versions (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2):
// a host asks for symbol packages by range, as npm does, and gets the exact versions
// `npmRegistry` reads, closed over the symbol packages they depend on. A lock keeps what was
// chosen: a locked version stays while every range asking for it still admits it, so a page
// means at run time what it meant when it was locked.

import { maxSatisfying, rsort, satisfies, validRange } from "semver";
import { admitsSystem, type FetchJson, fetchJson, type SymbolPackageField } from "./npm-registry.ts";
import { SYSTEM_VERSION } from "./system.ts";

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
  /** The system's version, which a chosen version's `system` range must admit: ours by default. */
  readonly system?: string;
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
 * field. One version per package, the highest every range asking for it admits and whose
 * `system` range admits the system's version; a range
 * nothing satisfies, or two ranges no one version meets, throws, naming them.
 */
export async function lockPackages(wanted: readonly string[], options: LockOptions = {}): Promise<PackageLock> {
  const { lock = {}, cdn = "https://cdn.jsdelivr.net/npm", fetch = fetchJson, system = SYSTEM_VERSION } = options;
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

  type PackageJson = { enumeratio?: SymbolPackageField; dependencies?: Record<string, string> };
  const manifests = new Map<string, Promise<PackageJson>>();
  const packageJson = (name: string, version: string): Promise<PackageJson> => {
    const key = `${name}@${version}`;
    let found = manifests.get(key);
    if (found === undefined) {
      found = fetch(`${cdn}/${key}/package.json`) as Promise<PackageJson>;
      manifests.set(key, found);
    }
    return found;
  };
  /** A version the system can run: its `system` range admits the system's version. */
  const runs = async (name: string, version: string): Promise<boolean> => {
    const { enumeratio } = await packageJson(name, version);
    return enumeratio === undefined || admitsSystem(enumeratio, system);
  };

  type Ask = { readonly name: string; readonly range: string; readonly by: string };
  const host: Ask[] = wanted.map((spec) => ({ ...parseWanted(spec), by: "the host" }));
  // What each package version asks of the symbol packages it depends on, read once.
  const asksOf = new Map<string, Promise<Ask[]>>();
  const dependencyAsks = (name: string, version: string): Promise<Ask[]> => {
    const key = `${name}@${version}`;
    let found = asksOf.get(key);
    if (found === undefined) {
      found = (async () => {
        const pkg = await packageJson(name, version);
        if (pkg.enumeratio === undefined) throw new Error(`${key} isn't a symbol package`);
        const asks: Ask[] = [];
        for (const [dependency, range] of Object.entries(pkg.dependencies ?? {})) {
          // Any version in range tells whether it's a symbol package: the locked one if it is.
          const locked = lock[dependency];
          const any = locked !== undefined && satisfies(locked, range) ? locked : await highest(dependency, range);
          if (any === null) throw new Error(`no version of ${dependency} satisfies ${range} (${key})`);
          const dependencyPkg = await packageJson(dependency, any);
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
      const admitted = (version: string): boolean => asked.every(({ range }) => satisfies(version, range));
      const locked = lock[name];
      if (locked !== undefined && admitted(locked) && (await runs(name, locked))) {
        next.set(name, locked);
        continue;
      }
      // Highest first, the first the system can run.
      let found: string | undefined;
      for (const version of rsort((await versionsOf(name)).filter(admitted)))
        if (await runs(name, version)) {
          found = version;
          break;
        }
      if (found === undefined) {
        const asks = asked.map(({ range, by }) => `${range} (${by})`).join(", ");
        const any = (await versionsOf(name)).some(admitted);
        throw new Error(`no version of ${name} satisfies ${asks}${any ? ` and runs on the system ${system}` : ""}`);
      }
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
