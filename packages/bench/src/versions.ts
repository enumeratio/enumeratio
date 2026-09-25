// What each system's report records as its version (design/benchmarking.md §7): the kernel
// itself, plus the pinned packages its mappings reach. Probed once per run, never timed.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { version as ceVersion } from "@cortex-js/compute-engine";
import type { BenchSystem } from "./types.ts";

export interface Version {
  readonly version: string;
  readonly packages?: Readonly<Record<string, string>>;
}

const oracle = (path: string): string => fileURLToPath(new URL(`../../oracle/${path}`, import.meta.url));

function probe(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", timeout: 60_000 }).trim().split("\n")[0]!;
  } catch {
    return "unknown";
  }
}

/** `name = version` for the named packages in a Julia Manifest.toml or a Cargo.lock. */
function pinned(file: string, names: readonly string[]): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  // Both files are a list of `[[…]]` blocks, one per package, each with its own version line.
  for (const block of text.split(/\n(?=\[\[)/)) {
    const name = /^\[\[deps\.([\w-]+)\]\]|^\[\[package\]\]\s*name = "([\w-]+)"/.exec(block);
    const key = name?.[1] ?? name?.[2];
    const version = /^version = "([^"]+)"/m.exec(block)?.[1];
    if (key !== undefined && names.includes(key) && version !== undefined) out[key] = version;
  }
  return out;
}

const python = (module: string): string => probe("python3", ["-c", `import ${module}; print(${module}.__version__)`]);

export function versionOf(system: BenchSystem): Version {
  switch (system) {
    case "ts":
      return {
        version: `node ${process.versions.node}`,
        packages: { "compute-engine": ceVersion },
      };
    case "mpmath":
      return { version: `mpmath ${python("mpmath")}` };
    case "sympy":
      return { version: `sympy ${python("sympy")}` };
    case "sage":
      return { version: probe("sage", ["--version"]) };
    case "julia":
      return {
        version: probe("julia", ["--version"]),
        packages: pinned(oracle("julia/Manifest.toml"), ["Nemo", "Combinatorics", "FLINT_jll"]),
      };
    case "oscar":
      return {
        version: probe("julia", ["--version"]),
        packages: pinned(oracle("oscar/Manifest.toml"), ["Oscar", "Nemo", "FLINT_jll"]),
      };
    case "rust":
      return {
        version: probe("rustc", ["--version"]),
        packages: pinned(oracle("rust/Cargo.lock"), ["num-bigint", "primal", "statrs", "adic"]),
      };
    case "wolfram":
      // Starting a kernel just to ask costs a license seat; the harness reports $Version.
      return { version: "unknown" };
  }
}
