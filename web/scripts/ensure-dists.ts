// The site resolves workspace packages through their built `dist/`. Before `dev`, build any package whose
// dist entry is missing (with its dependencies), so a fresh or cleaned checkout starts. Stale dists are not detected.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type Pkg = { name: string; path: string };
type Exports = string | { [key: string]: Exports } | null | undefined;

const pnpm = (...args: string[]): string => execFileSync("pnpm", args, { encoding: "utf8" });

const distTargets = (exports: Exports): string[] =>
  typeof exports === "string"
    ? exports.startsWith("./dist/")
      ? [exports]
      : []
    : Object.values(exports ?? {}).flatMap(distTargets);

const packages: Pkg[] = JSON.parse(pnpm("ls", "-r", "--depth", "-1", "--json"));
const missing = packages
  .filter(({ name }) => name !== "@enumeratio/web")
  .filter(({ path }) => {
    const { exports } = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
    return distTargets(exports).some((target) => !existsSync(join(path, target)));
  })
  .map(({ name }) => name);

if (missing.length) {
  console.log(`building missing dists: ${missing.join(", ")}`);
  execFileSync("pnpm", [...missing.flatMap((name) => ["--filter", `${name}...`]), "run", "build"], {
    stdio: "inherit",
  });
}
