// Step 3 of design/examples-as-data.md §8: symbol packages move to packages/symbols/<group>/.
//
//   node packages/reference/scripts/migrate/move-layout.ts
//
// `git mv` per package, then every tracked path that names one is rewritten (workflows,
// scripts, `source:` pointers, docs). Package names and dependency edges don't change.
// Run `vp install` afterwards to relink node_modules and refresh the lockfile.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const GROUPS: Readonly<Record<string, readonly string[]>> = {
  arithmetic: ["residues", "numerals", "number-theory", "adeles"],
  analysis: ["analytic"],
  combinatorics: ["collections", "statistics", "domains", "polytope"],
  algebras: ["algebra", "hypercomplex", "geometric", "diagram", "groupalgebra", "hecke", "hopf", "incidence", "quiver"],
  groups: ["braid", "modular"],
  evaluation: ["aestimatio"],
};

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const git = (...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8" });

const moves = Object.entries(GROUPS).flatMap(([group, pkgs]) =>
  pkgs.map((pkg) => ({ pkg, to: `packages/symbols/${group}/${pkg}` })),
);

for (const { pkg, to } of moves) {
  if (existsSync(`${root}${to}`)) throw new Error(`${to} already exists; remove it first`);
  execFileSync("mkdir", ["-p", to.slice(0, to.lastIndexOf("/"))], { cwd: root });
  git("mv", `packages/${pkg}`, to);
  // What git doesn't track stays behind: build output and links, rebuilt after `vp install`.
  if (!existsSync(`${root}packages/${pkg}`)) continue;
  const left = execFileSync("ls", ["-A", `packages/${pkg}`], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  if (left.some((f) => f !== "dist" && f !== "node_modules"))
    throw new Error(`packages/${pkg}: untracked ${left.join(", ")}`);
  execFileSync("rm", ["-rf", `packages/${pkg}`], { cwd: root });
}

// `packages/<pkg>` not followed by more of a name (`packages/algebra` ≠ `packages/algebras`).
const names = moves.map((m) => m.pkg).sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![\\w-])packages/(${names.join("|")})(?![\\w-])`, "g");
const target = new Map(moves.map((m) => [m.pkg, m.to]));

const files = git("ls-files")
  .split("\n")
  .filter((f) => f && f !== "pnpm-lock.yaml" && !/\.(png|jpe?g|gif|webp|woff2?|ico|wasm)$/.test(f));
let touched = 0;
for (const file of files) {
  const path = `${root}${file}`;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    continue;
  }
  const next = text.replace(pattern, (_all, pkg: string) => target.get(pkg)!);
  if (next !== text) {
    writeFileSync(path, next);
    touched++;
  }
}

// Relative paths that climb out of a moved package: two levels deeper now.
const deeper = [
  ["packages/symbols/combinatorics/collections/tests/definitions-core.test.ts", '"../../.."', '"../../../../.."'],
] as const;
for (const [file, from, to] of deeper) {
  const path = `${root}${file}`;
  const text = readFileSync(path, "utf8");
  if (!text.includes(from)) throw new Error(`${file}: ${from} not found`);
  writeFileSync(path, text.replace(from, to));
}

const ws = `${root}pnpm-workspace.yaml`;
writeFileSync(ws, readFileSync(ws, "utf8").replace("  - packages/*\n", "  - packages/*\n  - packages/symbols/*/*\n"));

console.log(`${moves.length} packages moved, ${touched} files rewritten`);
