// Readies the core a library outside this repository builds on for GitHub Packages: each package
// at `version`, publishable there (it stays `private` for npm in the tree), its registry the
// GitHub one. Run by .github/workflows/publish-core.yml on a throwaway checkout, never committed.
//
//   node tools/publish/prepare-core.ts 0.1.0-next.1

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** What an extracted leaf library (hopf) imports or builds with, and what those import. */
const CORE = ["engine", "entry", "manifest", "boxes", "structures", "ce-patches"];

const REGISTRY = "https://npm.pkg.github.com";

const version = (process.argv[2] ?? "").replace(/^core-v/, "");
if (!/^\d+\.\d+\.\d+-next\.\d+$/.test(version))
  throw new Error(`a prerelease version (0.1.0-next.1), not "${version}"`);

const root = resolve(import.meta.dirname, "../..");
for (const name of CORE) {
  const file = join(root, "packages", name, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
  if (pkg.name !== `@enumeratio/${name}`) throw new Error(`${file} is ${String(pkg.name)}`);
  delete pkg.private;
  pkg.version = version;
  pkg.publishConfig = { registry: REGISTRY };
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
}
// The workflow publishes exactly these, by pnpm filter.
const filters = CORE.map((name) => `--filter=@enumeratio/${name}`).join(" ");
if (process.env.GITHUB_OUTPUT !== undefined) appendFileSync(process.env.GITHUB_OUTPUT, `filters=${filters}\n`);
console.log(`${CORE.join(", ")} at ${version} for ${REGISTRY}`);
