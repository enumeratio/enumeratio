// Our libraries a workspace package installs from a registry, not from this workspace: until
// each host assembles the manifest from what it installs (https://github.com/enumeratio/enumeratio/wiki/Speculative-Per-Package-Repos
// §4.1), the build reads their records and placements as if they were here.

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";

const SCOPE = "@enumeratio";

/** Each `@enumeratio` package installed under one of `workspaceDirs` that resolves outside
 *  `root`, by name, with its directory. Two different installs of one name are an error: the
 *  manifest has one record per head. */
export function installedLibraries(
  workspaceDirs: readonly string[],
  root: string,
): { readonly name: string; readonly dir: string }[] {
  const found = new Map<string, string>();
  for (const dir of workspaceDirs) {
    const scope = join(dir, "node_modules", SCOPE);
    if (!existsSync(scope)) continue;
    for (const entry of readdirSync(scope)) {
      const link = join(scope, entry);
      if (!existsSync(link)) continue; // a link left by a package since renamed
      const real = realpathSync(link);
      if (!relative(root, real).startsWith("..")) continue; // a workspace package
      const { name } = JSON.parse(readFileSync(join(real, "package.json"), "utf8")) as { name: string };
      const seen = found.get(name);
      if (seen !== undefined && seen !== real) throw new Error(`${name} is installed twice: ${seen} and ${real}`);
      found.set(name, real);
    }
  }
  return [...found].toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([name, dir]) => ({ name, dir }));
}
