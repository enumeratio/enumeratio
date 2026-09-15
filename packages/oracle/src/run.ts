// Batch-evaluate emitted source in each external system.
//
// One process per system per scan, not one per expression: starting a Wolfram kernel or a
// Sage session costs seconds, and there are hundreds of expressions. Each runner takes a
// list of sources and returns a list of results positionally, with a per-item error rather
// than a failed batch — one bad expression must not lose the other three hundred.

import { execFileSync } from "node:child_process";
import type { System } from "./systems.ts";

export type Result = { readonly value: string } | { readonly error: string };

const failAll = (count: number, reason: string): Result[] =>
  Array.from({ length: count }, () => ({ error: reason }));

/** Wolfram: evaluate each source, printing one line per item as `FullForm` — uniform
 * `Head[args]` that `fromWolfram` parses, so the answer can be compared structurally
 * rather than as text. Each source is handed to `ToExpression` as a string: a syntax
 * error then yields `$Failed` for that item instead of aborting the batch, which
 * used to silently zero every item after the first bad one. */
function runWolfram(sources: readonly string[]): Result[] {
  if (sources.length === 0) return [];
  const list = sources.map((source) => JSON.stringify(source)).join(", ");
  const code = `Do[Print["<<", i, ">>", ToString[FullForm[Quiet[ToExpression[{${list}}[[i]]]]]]], {i, 1, ${sources.length}}]`;
  try {
    const out = execFileSync("wolframscript", ["-code", code], {
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return collect(out, sources.length);
  } catch (error) {
    return failAll(sources.length, `wolframscript: ${String(error).slice(0, 120)}`);
  }
}

/** SymPy / mpmath / Sage all evaluate Python, differing only in the preamble and binary. */
function runPython(
  sources: readonly string[],
  binary: string,
  preamble: string,
  args: readonly string[] = ["-c"],
): Result[] {
  if (sources.length === 0) return [];
  const program = `${preamble}
import json, sys
sources = json.loads(${JSON.stringify(JSON.stringify(sources))})
for i, src in enumerate(sources):
    try:
        print("<<%d>>%s" % (i + 1, str(eval(src))))
    except Exception as exc:
        print("<<%d>>!!%s" % (i + 1, type(exc).__name__ + ": " + str(exc)[:100]))
`;
  try {
    const out = execFileSync(binary, [...args, program], {
      encoding: "utf8",
      timeout: 900_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return collect(out, sources.length);
  } catch (error) {
    return failAll(sources.length, `${binary}: ${String(error).slice(0, 120)}`);
  }
}

/** Pull `<<n>>value` lines out of a transcript, tolerating anything else the kernel prints. */
function collect(output: string, count: number): Result[] {
  const results: Result[] = failAll(count, "no output");
  for (const line of output.split("\n")) {
    const match = /^<<(\d+)>>(.*)$/.exec(line);
    if (match === null) continue;
    const index = Number(match[1]) - 1;
    const body = match[2] as string;
    if (index >= 0 && index < count) {
      results[index] =
        body.startsWith("!!") || body.trim() === "$Failed"
          ? { error: body.startsWith("!!") ? body.slice(2) : "$Failed" }
          : { value: body.trim() };
    }
  }
  return results;
}

export function runIn(system: System, sources: readonly string[]): Result[] {
  switch (system) {
    case "wolfram":
      return runWolfram(sources);
    case "sympy":
      return runPython(sources, "python3", "from sympy import *");
    case "mpmath":
      return runPython(sources, "python3", "from mpmath import *\nmp.dps = 30");
    case "sage":
      // `sage -c` takes one program string, like python3 -c.
      return runPython(sources, "sage", "", ["-c"]);
    default:
      return failAll(sources.length, `${system} has no runner yet`);
  }
}
