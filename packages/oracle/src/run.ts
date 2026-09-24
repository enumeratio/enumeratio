// Batch-evaluate emitted source in each external system.
//
// One process per batch, not one per expression: starting a Wolfram kernel or a Sage session
// costs seconds, and there are hundreds of expressions. Batches run one at a time and each
// item is time-capped (and memory-capped, in Wolfram), so one runaway example can neither
// take the machine down nor lose the rest of the scan. Each runner returns results
// positionally, with a per-item error rather than a failed batch.

import { execFileSync } from "node:child_process";
import type { System } from "./systems.ts";

/** Sources per kernel process. */
const BATCH = 40;
/** Seconds one item may run before it counts as an error. */
const ITEM_SECONDS = 30;
/** Resident bytes a kernel may reach before the item it is on counts as an error. */
const MAX_BYTES = 1024 ** 3;

export type Result =
  | { readonly value: string; readonly display?: string }
  | { readonly error: string };

// A time cap cannot stop C code (PARI) that only grows, and a thread inside the kernel cannot
// run while that code holds the GIL. So a supervisor outside it polls the kernel's process
// group, kills it past MAX_BYTES, and names the item it was on (the one after the last
// printed); runIn resumes the batch after that.
const SUPERVISOR = `
import os, re, signal, subprocess, sys, threading, time
limit = int(sys.argv[1])
kernel = subprocess.Popen(sys.argv[2:], stdout=subprocess.PIPE, text=True, start_new_session=True)
killed = False
def watch():
    global killed
    while kernel.poll() is None:
        table = subprocess.run(["ps", "-A", "-o", "pgid=,rss="], capture_output=True, text=True).stdout
        rss = sum(int(r) for g, r in (row.split() for row in table.splitlines()) if int(g) == kernel.pid)
        if rss * 1024 > limit:
            killed = True
            os.killpg(kernel.pid, signal.SIGKILL)
            return
        time.sleep(0.1)
threading.Thread(target=watch, daemon=True).start()
last = 0
for line in kernel.stdout:
    done = re.match(r"<<(\\d+)", line)
    if done:
        last = int(done.group(1))
    sys.stdout.write(line)
    sys.stdout.flush()
kernel.wait()
if killed:
    print("<<%d>>!!MemoryError: over %d MiB" % (last + 1, limit // 2**20), flush=True)
elif kernel.returncode != 0:
    # Killed from outside (macOS reclaims memory faster than the poll) or crashed.
    print("<<%d>>!!KernelDied: exit %d" % (last + 1, kernel.returncode), flush=True)
`;

/** What a kernel printed before it died, so the items it finished are kept. */
const stdoutOf = (error: unknown): string => String((error as { stdout?: unknown }).stdout ?? "");

const failAll = (count: number, reason: string): Result[] =>
  Array.from({ length: count }, () => ({ error: reason }));

/** Wolfram: evaluate each source once, printing its `FullForm` — uniform `Head[args]` that
 * `fromWolfram` parses, so the answer can be compared structurally rather than as text —
 * and its `InputForm` on a second, `|`-marked line as `display`, for a reader. Each source
 * is handed to `ToExpression` as a string: a syntax error then yields `$Failed` for that
 * item instead of aborting the batch, which used to silently zero every item after the
 * first bad one. */
function runWolfram(sources: readonly string[]): Result[] {
  if (sources.length === 0) return [];
  const list = sources.map((source) => JSON.stringify(source)).join(", ");
  const code = `Do[Module[{v = Quiet[MemoryConstrained[TimeConstrained[ToExpression[{${list}}[[i]]], ${ITEM_SECONDS}, $Aborted], ${MAX_BYTES}, $Aborted]]}, Print["<<", i, ">>", ToString[FullForm[v]]]; Print["<<", i, "|>>", ToString[InputForm[v]]]], {i, 1, ${sources.length}}]`;
  try {
    const out = execFileSync("wolframscript", ["-code", code], {
      encoding: "utf8",
      timeout: 600_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    return collectWolfram(out, sources.length);
  } catch (error) {
    const partial = stdoutOf(error);
    return partial
      ? collectWolfram(partial, sources.length)
      : failAll(sources.length, `wolframscript: ${String(error).slice(0, 120)}`);
  }
}

/** SymPy / mpmath / Sage all evaluate Python, differing only in the preamble, binary and
 * evaluator. Sage's own preparser (which turns an integer division like `2/3` into an exact
 * `Rational`, not a float) only runs on the program `sage -c` is handed, not on a string
 * passed to plain `eval()` at runtime — so a Sage source has to go through `sage_eval`
 * instead, or every `/` an emit template writes silently becomes a float. */
function runPython(
  sources: readonly string[],
  binary: string,
  preamble: string,
  args: readonly string[] = ["-c"],
  evalExpr = (src: string) => `eval(${src})`,
): Result[] {
  if (sources.length === 0) return [];
  const program = `${preamble}
import json, signal, sys
def _timeout(signum, frame):
    raise TimeoutError("over ${ITEM_SECONDS}s")
signal.signal(signal.SIGALRM, _timeout)
sources = json.loads(${JSON.stringify(JSON.stringify(sources))})
for i, src in enumerate(sources):
    signal.alarm(${ITEM_SECONDS})
    try:
        print("<<%d>>%s" % (i + 1, str(${evalExpr("src")})), flush=True)
    except BaseException as exc:
        print("<<%d>>!!%s" % (i + 1, type(exc).__name__ + ": " + str(exc)[:100]), flush=True)
    finally:
        signal.alarm(0)
`;
  try {
    const out = execFileSync(
      "python3",
      ["-c", SUPERVISOR, String(MAX_BYTES), binary, ...args, program],
      {
        encoding: "utf8",
        timeout: 900_000,
        maxBuffer: 64 * 1024 * 1024,
      },
    );
    return collect(out, sources.length);
  } catch (error) {
    const partial = stdoutOf(error);
    return partial
      ? collect(partial, sources.length)
      : failAll(sources.length, `${binary}: ${String(error).slice(0, 120)}`);
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
        body.startsWith("!!") || body.trim() === "$Failed" || body.trim() === "$Aborted"
          ? { error: body.startsWith("!!") ? body.slice(2) : body.trim() }
          : { value: body.trim() };
    }
  }
  return results;
}

/** Like `collect`, plus the `<<n|>>` `InputForm` line as each value result's `display`. */
function collectWolfram(output: string, count: number): Result[] {
  const results = collect(output, count);
  for (const line of output.split("\n")) {
    const match = /^<<(\d+)\|>>(.*)$/.exec(line);
    if (match === null) continue;
    const index = Number(match[1]) - 1;
    const result = results[index];
    if (index >= 0 && index < count && result !== undefined && "value" in result) {
      results[index] = { ...result, display: (match[2] as string).trim() };
    }
  }
  return results;
}

// The one Sage helper an emit needs but has no one-liner for: PowerModList(a, s/r, m).
// `Zmod(m)(a)` has no fractional-power method, so the root and the power split by hand.
const SAGE_PREAMBLE = `
def enumeratio_power_mod_list(a, s, m):
    s = QQ(s)
    return sorted(int(x) for x in (Zmod(m)(a)**s.numerator()).nth_root(s.denominator(), all=True))

def _enumeratio_flatten(x):
    if isinstance(x, (list, tuple)):
        out = []
        for e in x:
            out.extend(_enumeratio_flatten(e))
        return out
    return [x]

def enumeratio_max(*args):
    return max(_enumeratio_flatten(list(args)))

def enumeratio_min(*args):
    return min(_enumeratio_flatten(list(args)))
`;

export function runIn(system: System, sources: readonly string[]): Result[] {
  const results: Result[] = [];
  let start = 0;
  while (start < sources.length) {
    const batch = runBatch(system, sources.slice(start, start + BATCH));
    // A kernel that died mid-batch leaves "no output" after the item that killed it.
    const lost = batch.findIndex((r) => "error" in r && r.error === "no output");
    // Nothing came back at all: count the first item as the culprit and move past it.
    const kept =
      lost === 0
        ? [{ error: "kernel died before answering" }]
        : lost > 0
          ? batch.slice(0, lost)
          : batch;
    results.push(...kept);
    start += kept.length;
  }
  return results;
}

function runBatch(system: System, sources: readonly string[]): Result[] {
  switch (system) {
    case "wolfram":
      return runWolfram(sources);
    case "sympy":
      return runPython(sources, "python3", "from sympy import *");
    case "mpmath":
      return runPython(sources, "python3", "from mpmath import *\nmp.dps = 30");
    case "sage":
      // `sage -c` takes one program string, like python3 -c. `locals=globals()` is what
      // lets `sage_eval` see SAGE_PREAMBLE's helpers — by default it only sees `sage.all`.
      return runPython(
        sources,
        "sage",
        `from sage.misc.sage_eval import sage_eval\n${SAGE_PREAMBLE}`,
        ["-c"],
        (src) => `sage_eval(${src}, locals=globals())`,
      );
    default:
      return failAll(sources.length, `${system} has no runner yet`);
  }
}
