// Ask each Python lane's runtime for the names its evaluation namespace already holds: Python's
// keywords and builtins, and the globals each lane's prelude (`preludeFor`) leaves behind. Shared
// by collect-reserved-names.ts, which writes src/reserved-names-data.ts, and the drift test.

import { spawnSync } from "node:child_process";
import { kernelVersion } from "../src/kernel-pin.ts";
import { preludeFor } from "../src/run.ts";
import type { System } from "../src/systems.ts";

export const LANES = ["sympy", "mpmath", "sage"] as const satisfies readonly System[];
export type Lane = (typeof LANES)[number];

/** A namespace as its runtime reports it: the release it came from, and its public names. */
export interface Namespace {
  readonly version: string;
  readonly names: readonly string[];
}

const MARK = "<<namespace>>";

/** A private name, or one of the helpers our preludes define: neither is a variable we'd write. */
const isPublic = (name: string): boolean => !name.startsWith("_") && !name.startsWith("enumeratio_");

// The lane's own release: a module's `__version__`, or Sage's `version()`.
const VERSION: Record<Lane, string> = {
  sympy: "import sympy; _v = sympy.__version__",
  mpmath: "import mpmath; _v = mpmath.__version__",
  sage: "_v = version()",
};

function ask(binary: string, args: readonly string[], program: string): Namespace | undefined {
  const run = spawnSync(binary, [...args, program], { encoding: "utf8", timeout: 300_000, maxBuffer: 1 << 26 });
  const line = run.status === 0 ? run.stdout.split("\n").find((l) => l.startsWith(MARK)) : undefined;
  return line === undefined ? undefined : (JSON.parse(line.slice(MARK.length)) as Namespace);
}

/** Python's keywords and builtins, versioned by the interpreter's minor release. */
export function pythonNamespace(): Namespace | undefined {
  return ask(
    "python3",
    ["-I", "-c"],
    `import builtins, json, keyword, sys
names = [n for n in keyword.kwlist + keyword.softkwlist + dir(builtins) if not n.startswith("_")]
print(${JSON.stringify(MARK)} + json.dumps({"version": "%d.%d" % sys.version_info[:2], "names": sorted(set(names))}))`,
  );
}

/** What `lane`'s prelude leaves in the namespace an emitted source is evaluated in; `undefined` where its runtime isn't installed. */
export function laneNamespace(lane: Lane): Namespace | undefined {
  const { binary, preamble } = preludeFor(lane);
  const found = ask(
    binary,
    ["-c"],
    `${preamble}
import json as _json
${VERSION[lane]}
print(${JSON.stringify(MARK)} + _json.dumps({"version": str(_v), "names": sorted(globals())}))`,
  );
  if (found === undefined) return undefined;
  return {
    version: lane === "sage" ? kernelVersion(found.version).release : found.version,
    names: found.names.filter(isPublic),
  };
}
