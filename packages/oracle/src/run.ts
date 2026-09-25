// Batch-evaluate emitted source in each external system.
//
// One process per batch, not one per expression: starting a Wolfram kernel or a Sage session
// costs seconds, and there are hundreds of expressions. Batches run one at a time and each
// item is time-capped (and memory-capped, in Wolfram and the Python family), so one runaway
// example can neither take the machine down nor lose the rest of the scan. Each runner
// returns results positionally, with a per-item error rather than a failed batch.
//
// Every kernel also runs under the process-group watchdog (bounded.ts), the ceiling for the
// kernels with no per-item cap of their own (Julia, Lean).

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Bounds, memoryCapMb, runBounded } from "./bounded.ts";
import type { System } from "./systems.ts";
/** Sources per kernel process. */
const BATCH = 40;
/** Seconds one item may run before it counts as an error. */
const ITEM_SECONDS = 30;
/** Resident bytes a kernel may reach before the item it is on counts as an error. */
const MAX_BYTES = 1024 ** 3;

export type Result =
  | { readonly value: string; readonly display?: string; readonly numeric?: string }
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

const failAll = (count: number, reason: string): Result[] =>
  Array.from({ length: count }, () => ({ error: reason }));

/** A directory beside this package (a Julia environment, the Lake project). */
const local = (name: string): string => fileURLToPath(new URL(`../${name}`, import.meta.url));

/** Run one batch: its transcript, or the reason there is none. A kernel that dies mid-batch
 * still leaves the items it finished, and runIn resumes after them. */
async function transcript(
  command: string,
  args: readonly string[],
  bounds: Bounds = {},
): Promise<{ out: string } | { reason: string }> {
  try {
    const run = await runBounded(command, args, { timeoutMs: 900_000, ...bounds });
    if (run.stdout !== "" || (run.killed === undefined && run.code === 0))
      return { out: run.stdout };
    const why =
      run.killed === undefined
        ? `exit ${run.code}: ${run.stderr.slice(0, 120)}`
        : `killed (${run.killed}, peak ${run.peakMb} MB)`;
    return { reason: `${command}: ${why}` };
  } catch (error) {
    return { reason: `${command}: ${String(error).slice(0, 120)}` };
  }
}

/** Write `program` to a throwaway file, hand its path to `run`, and clean up. */
async function withFile<T>(name: string, program: string, run: (file: string) => Promise<T>) {
  const dir = mkdtempSync(join(tmpdir(), "oracle-"));
  const file = join(dir, name);
  writeFileSync(file, program);
  try {
    return await run(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Wolfram: evaluate each source once, printing its `FullForm` — uniform `Head[args]` that
 * `fromWolfram` parses, so the answer can be compared structurally rather than as text —
 * the `FullForm` of its `N` on a `#`-marked line as `numeric`, Wolfram's own number for an
 * exact value like `Zeta[3]`, and its `InputForm` on a `|`-marked line as `display`, for a
 * reader. Each source
 * is handed to `ToExpression` as a string: a syntax error then yields `$Failed` for that
 * item instead of aborting the batch, which used to silently zero every item after the
 * first bad one. A `TestObject` keeps only its outcome fields: the rest (timestamps, IDs,
 * timings, memory) change every run and would rewrite its sidecar row on every scan. */
async function runWolfram(sources: readonly string[]): Promise<Result[]> {
  const list = sources.map((source) => JSON.stringify(source)).join(", ");
  const stable = `/. TestObject[a_Association] :> TestObject[KeyTake[a, {"Outcome", "Input", "ExpectedOutput", "ActualOutput"}]]`;
  const code = `Do[Module[{v = Quiet[MemoryConstrained[TimeConstrained[ToExpression[{${list}}[[i]]], ${ITEM_SECONDS}, $Aborted], ${MAX_BYTES}, $Aborted]] ${stable}}, Print["<<", i, ">>", ToString[FullForm[v]]]; Print["<<", i, "#>>", ToString[FullForm[Quiet[TimeConstrained[N[v], ${ITEM_SECONDS}, v]]]]]; Print["<<", i, "|>>", ToString[InputForm[v]]]], {i, 1, ${sources.length}}]`;
  const run = await transcript("wolframscript", ["-code", code], { timeoutMs: 600_000 });
  return "out" in run
    ? collectWolfram(run.out, sources.length)
    : failAll(sources.length, run.reason);
}

/** SymPy / mpmath / Sage all evaluate Python, differing only in the preamble, binary and
 * evaluator. Sage's own preparser (which turns an integer division like `2/3` into an exact
 * `Rational`, not a float) only runs on the program `sage -c` is handed, not on a string
 * passed to plain `eval()` at runtime — so a Sage source has to go through `sage_eval`
 * instead, or every `/` an emit template writes silently becomes a float. */
async function runPython(
  sources: readonly string[],
  binary: string,
  preamble: string,
  args: readonly string[] = ["-c"],
  evalExpr = (src: string) => `eval(${src})`,
  valueOf?: string,
): Promise<Result[]> {
  // With `valueOf`, the value line is that helper's rendering (compared) and a second
  // `|`-marked line carries the kernel's own form (displayed), as for Wolfram.
  const print = valueOf
    ? `v = ${evalExpr("src")}
        print("<<%d>>%s" % (i + 1, ${valueOf}(v)), flush=True)
        print("<<%d|>>%s" % (i + 1, str(v)), flush=True)`
    : `print("<<%d>>%s" % (i + 1, str(${evalExpr("src")})), flush=True)`;
  const program = `${preamble}
import json, signal, sys
def _timeout(signum, frame):
    raise TimeoutError("over ${ITEM_SECONDS}s")
signal.signal(signal.SIGALRM, _timeout)
sources = json.loads(${JSON.stringify(JSON.stringify(sources))})
for i, src in enumerate(sources):
    signal.alarm(${ITEM_SECONDS})
    try:
        ${print}
    except BaseException as exc:
        print("<<%d>>!!%s" % (i + 1, type(exc).__name__ + ": " + str(exc)[:100]), flush=True)
    finally:
        signal.alarm(0)
`;
  const run = await transcript("python3", [
    "-c",
    SUPERVISOR,
    String(MAX_BYTES),
    binary,
    ...args,
    program,
  ]);
  if (!("out" in run)) return failAll(sources.length, run.reason);
  return valueOf ? collectWolfram(run.out, sources.length) : collect(run.out, sources.length);
}

/** A Julia environment next to this package: `oscar/` for Oscar, `julia/` for Nemo +
 * Combinatorics.jl. Rationals print as floats so they compare numerically, as ours do. */
async function runJulia(
  sources: readonly string[],
  project: string,
  using: string,
  /** A Julia file of helpers the environment's emit templates call. */
  preamble?: string,
): Promise<Result[]> {
  // A JSON string is a Julia string literal once `$` stops interpolating.
  const list = sources.map((source) => JSON.stringify(source).replace(/\$/g, "\\$")).join(",\n");
  const program = `using ${using}
show_oracle(x) = string(x)
show_oracle(x::Rational) = string(Float64(x))
show_oracle(x::QQFieldElem) = string(Float64(x))
show_oracle(x::AbstractVector) = "[" * join(map(show_oracle, x), ", ") * "]"
${preamble === undefined ? "" : `include(${JSON.stringify(preamble)})`}
for (i, src) in enumerate([${list}])
    try
        println("<<", i, ">>", show_oracle(Core.eval(Main, Meta.parse(src))))
    catch e
        println("<<", i, ">>!!", first(replace(sprint(showerror, e), '\\n' => ' '), 100))
    end
end
`;
  const run = await withFile("batch.jl", program, (file) =>
    transcript("julia", [...juliaFlags(project), file], {}),
  );
  return "out" in run ? collect(run.out, sources.length) : failAll(sources.length, run.reason);
}

/** Single-threaded, with the GC told to stay under three quarters of the cap. */
export const juliaFlags = (project: string): string[] => [
  `--project=${local(project)}`,
  "--startup-file=no",
  "--threads=1",
  `--heap-size-hint=${Math.floor(memoryCapMb() * 0.75)}M`,
];

/** The Mathlib modules the `mathlib4` mapping rows reach. All of Mathlib would be simpler, but
 * it costs several GB resident, and the umbrella module is not always in the cache. */
const LEAN_IMPORTS = [
  "Mathlib.Combinatorics.Enumerative.Catalan.Basic",
  "Mathlib.Combinatorics.Enumerative.Stirling",
  "Mathlib.Data.Nat.Choose.Basic",
  "Mathlib.Data.Nat.Digits.Defs",
  "Mathlib.Data.Nat.Factorial.Basic",
  "Mathlib.Data.Nat.Fib.Basic",
  "Mathlib.Data.Nat.Prime.Basic",
  "Mathlib.Data.Nat.Totient",
  "Mathlib.Data.Rat.Defs",
  "Mathlib.NumberTheory.ArithmeticFunction.Moebius",
  "Mathlib.NumberTheory.PrimeCounting",
];

/** Lean: one `#eval` per line of a file importing Mathlib, elaborated in the `lean/` Lake
 * project. Lean reports an error per command, by line, so a bad item costs only itself. */
async function runLean(sources: readonly string[]): Promise<Result[]> {
  const header = [...LEAN_IMPORTS.map((module) => `import ${module}`), "open Nat"];
  const lines = sources.map(
    (source, i) => `#eval IO.println ("<<${i + 1}>>" ++ toString (${source}))`,
  );
  const cap = memoryCapMb();
  const run = await withFile("Batch.lean", [...header, ...lines, ""].join("\n"), (file) =>
    transcript("lake", ["env", "lean", `--memory=${cap}`, "--threads=1", file], {
      cwd: local("lean"),
      memoryMb: cap,
    }),
  );
  if (!("out" in run)) return failAll(sources.length, run.reason);
  const results = collect(run.out, sources.length);
  for (const match of run.out.matchAll(/:(\d+):\d+: error(?:\([^)]*\))?: (.*)/g)) {
    const index = Number(match[1]) - header.length - 1;
    if (index >= 0 && index < sources.length && !("value" in results[index]!)) {
      results[index] = { error: (match[2] as string).slice(0, 100) };
    }
  }
  return results;
}

/** Pull `<<n>>value` lines out of a transcript, tolerating anything else the kernel prints. */
function collect(output: string, count: number): Result[] {
  const results: Result[] = failAll(count, "no output");
  // Split on bare CR too: Oscar's banner leaves one before the first item.
  for (const line of output.split(/\r\n|\r|\n/)) {
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

/** Like `collect`, plus the `<<n|>>` `InputForm` line as each value result's `display`
 * and the `<<n#>>` line as its `numeric`. */
function collectWolfram(output: string, count: number): Result[] {
  const results = collect(output, count);
  for (const line of output.split("\n")) {
    const match = /^<<(\d+)([|#])>>(.*)$/.exec(line);
    if (match === null) continue;
    const index = Number(match[1]) - 1;
    const result = results[index];
    if (index >= 0 && index < count && result !== undefined && "value" in result) {
      const field = match[2] === "|" ? "display" : "numeric";
      results[index] = { ...result, [field]: (match[3] as string).trim() };
    }
  }
  return results;
}

// Sage helpers for emits with no one-liner. The diagram algebras live over ZZ[delta], so a
// product that closes a loop comes back with its power of delta, printed (like an Oscar
// group-algebra element) as a basis → coefficient map for compareCombination. PowerModList(a, s/r, m): `Zmod(m)(a)` has no
// fractional-power method, so the root and the power split by hand. PrimitiveRootList(n):
// `primitive_root` gives one root, so walk its powers coprime to phi(n). And the value a
// scan compares: a closed form (`1/2*sqrt(2)`, `pi^2/6`) as its number, exact rationals and
// integers as they are.
const SAGE_PREAMBLE = `
def enumeratio_primitive_root_list(n):
    try:
        g = primitive_root(n)
    except ValueError:
        return []
    phi = euler_phi(n)
    return sorted(int(power_mod(g, k, n)) for k in range(1, phi + 1) if gcd(k, phi) == 1)

enumeratio_ring = PolynomialRing(ZZ, "delta")
enumeratio_delta = enumeratio_ring.gen()

def _enumeratio_is_element(x):
    from sage.combinat.free_module import CombinatorialFreeModule
    return hasattr(x, "parent") and isinstance(x.parent(), CombinatorialFreeModule)

def _enumeratio_key(d):
    try:
        blocks = sorted(sorted(int(p) for p in b) for b in d)
    except TypeError:
        return str(d)
    return "Diagram({" + ",".join("{" + ",".join(map(str, b)) + "}" for b in blocks) + "})"

def _enumeratio_terms(x):
    terms = {}
    for d, c in x.monomial_coefficients().items():
        c = enumeratio_ring(c)
        for e, a in c.dict().items():
            terms[_enumeratio_key(d) + ("*delta^%d" % e if e else "")] = int(a)
    return terms

def enumeratio_diagram(blocks):
    k = max(abs(p) for b in blocks for p in b)
    return PartitionAlgebra(k, enumeratio_delta, enumeratio_ring)(blocks)

def enumeratio_element(x, A):
    if not _enumeratio_is_element(x):
        return x in A
    (d,) = x.monomial_coefficients().keys()
    keys = A.basis().keys()
    if all(len(b) == 2 and min(b) < 0 < max(b) for b in d) and "Symmetric" in type(A).__name__:
        top = {max(b): -min(b) for b in d}
        return Permutation([top[i] for i in sorted(top)]) in keys
    try:
        return SetPartition(list(d)) in keys
    except (TypeError, ValueError):
        return False

def enumeratio_partition_mobius(a, b):
    (da,), (db,) = a.monomial_coefficients().keys(), b.monomial_coefficients().keys()
    k = max(abs(p) for blk in da for p in blk)
    point = lambda p: p if p > 0 else k - p
    relabel = lambda d: SetPartition([[point(p) for p in blk] for blk in d])
    return posets.SetPartitions(2 * k).moebius_function(relabel(da), relabel(db))

def enumeratio_value(x):
    import json
    if isinstance(x, list) and x and all(_enumeratio_is_element(e) for e in x):
        return "combinations:" + json.dumps([_enumeratio_terms(e) for e in x])
    if _enumeratio_is_element(x):
        return "combination:" + json.dumps(_enumeratio_terms(x))
    if isinstance(x, list):
        return "[" + ", ".join(enumeratio_value(e) for e in x) + "]"
    if isinstance(x, (bool, int, tuple)):
        return str(x)
    try:
        if x in QQ:
            return str(x)
        z = CC(x)
        return repr(float(z.real())) if z.imag() == 0 else str(x)
    except Exception:
        return str(x)

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

export async function runIn(system: System, sources: readonly string[]): Promise<Result[]> {
  const results: Result[] = [];
  let start = 0;
  while (start < sources.length) {
    const batch = await runBatch(system, sources.slice(start, start + BATCH));
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

function runBatch(system: System, sources: readonly string[]): Promise<Result[]> {
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
        "enumeratio_value",
      );
    case "oscar":
      return runJulia(sources, "oscar", "Oscar", join(local("oscar"), "preamble.jl"));
    case "julia":
      return runJulia(sources, "julia", "Nemo, Combinatorics");
    case "mathlib4":
      return runLean(sources);
  }
}
