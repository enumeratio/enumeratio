// Batch-evaluate emitted source in each external system.
//
// One process per batch, not one per expression: starting a Wolfram kernel or a Sage session
// costs seconds, and there are hundreds of expressions. Batches run one at a time and each
// item is time-capped (and memory-capped, in Wolfram, the Python family and Julia), so one runaway
// example can neither take the machine down nor lose the rest of the scan. Each runner
// returns results positionally, with a per-item error rather than a failed batch.
//
// Every kernel also runs under the process-group watchdog (bounded.ts), the ceiling for the
// kernels with no per-item cap of their own (Lean).

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Bounds, memoryCapMb, runBounded } from "./bounded.ts";
import type { System } from "./systems.ts";
/** Sources per kernel process. */
const BATCH = 40;
/** Seconds one item may run before it counts as an error. */
const ITEM_SECONDS = 30;
/** Seconds a Python kernel may print nothing before the supervisor kills it. SIGALRM only
 * lands between bytecodes, so a C-level call (a huge integer power) outlives ITEM_SECONDS. */
const PYTHON_STALL_SECONDS = 2 * ITEM_SECONDS;
/** Resident bytes a kernel may reach before the item it is on counts as an error. */
const MAX_BYTES = 1024 ** 3;

export type Result =
  | {
      readonly value: string;
      readonly display?: string;
      readonly numeric?: string;
      /** Wolfram only, for an arbitrary-precision value: the digits Wolfram displays -- its
       * `N[x, d]` keeps every digit it computed (`0.125` at precision 2) and rounds only when
       * it prints, so this is the line that says how it rounds. */
      readonly shown?: string;
      /** Wolfram only: `TeXForm` of the input as written (held) and of the value. */
      readonly tex?: { readonly input: string; readonly output: string };
    }
  | { readonly error: string };

// A time cap cannot stop C code (PARI) that only grows, and a thread inside the kernel cannot
// run while that code holds the GIL. So a supervisor outside it polls the kernel's process
// group, kills it past a byte limit -- or, given a stall limit, once no line has come for that
// many seconds since the first -- and names the item it was on (the one after the last
// printed); runIn resumes the batch after that. Arguments: bytes, stall seconds (0: none),
// then the kernel's command line.
const SUPERVISOR = `
import os, re, signal, subprocess, sys, threading, time
limit = int(sys.argv[1])
stall = int(sys.argv[2])
kernel = subprocess.Popen(sys.argv[3:], stdout=subprocess.PIPE, text=True, start_new_session=True)
killed = None
progress = None
def watch():
    global killed
    while kernel.poll() is None:
        table = subprocess.run(["ps", "-A", "-o", "pgid=,rss="], capture_output=True, text=True).stdout
        rss = sum(int(r) for g, r in (row.split() for row in table.splitlines()) if int(g) == kernel.pid)
        if rss * 1024 > limit:
            killed = "MemoryError: over %d MiB" % (limit // 2**20)
        elif stall and progress is not None and time.time() - progress > stall:
            killed = "TimeoutError: over %d s" % stall
        if killed:
            os.killpg(kernel.pid, signal.SIGKILL)
            return
        time.sleep(0.1)
threading.Thread(target=watch, daemon=True).start()
last = 0
for line in kernel.stdout:
    progress = time.time()
    done = re.match(r"<<(\\d+)", line)
    if done:
        last = int(done.group(1))
    sys.stdout.write(line)
    sys.stdout.flush()
kernel.wait()
if killed:
    print("<<%d>>!!%s" % (last + 1, killed), flush=True)
elif kernel.returncode != 0:
    # Killed from outside (macOS reclaims memory faster than the poll) or crashed.
    print("<<%d>>!!KernelDied: exit %d" % (last + 1, kernel.returncode), flush=True)
`;

const failAll = (count: number, reason: string): Result[] => Array.from({ length: count }, () => ({ error: reason }));

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
    if (run.stdout !== "" || (run.killed === undefined && run.code === 0)) return { out: run.stdout };
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
 * exact value like `Zeta[3]`, its `InputForm` on a `|`-marked line as `display`, for a
 * reader, and `TeXForm` of the held input and of the value on `^`/`$` lines as `tex`, so
 * notation can be compared with ours (newlines, which `TeXForm` puts in arrays, folded to
 * spaces). An arbitrary-precision value (a finite `Precision`, which a machine number and an
 * exact value don't have) also prints the digits Wolfram displays for it on a `~` line, as
 * `shown`: `NumberForm` with no exponent, so a small number stays on one line. Each source
 * is handed to `ToExpression` as a string: a syntax error then yields `$Failed` for that
 * item instead of aborting the batch, which used to silently zero every item after the
 * first bad one. A `TestObject` keeps only its outcome fields: the rest (timestamps, IDs,
 * timings, memory) change every run and would rewrite its implementations row on every scan. */
/** The Wolfram source for one batch scan, as a pure string build — split out from `runWolfram`
 * so its shape (the `Module`-scoped loop counter, below) can be asserted on without a kernel.
 *
 * `Do`'s iterator is NOT lexically scoped the way `Module`'s locals are: it is a plain global
 * symbol (`Global\`i`, say) that the loop temporarily assigns 1..n to, visible to anything
 * that reads that same symbol — including a batched item's own `ToExpression`'d source, if it
 * happens to reference a bare symbol under the same name. Found the hard way: a compute-engine
 * symbol literally named `i_1` (ours, not the imaginary unit) transpiles to `Subscript[i, 1]`,
 * and when that item landed at loop position 5, `i` read back as `5` instead of the free
 * symbol — corrupting that one item's output. `Module[{k}, Do[..., {k, 1, n}]]` renames the
 * counter to a Module-local `k$nnn` gensym, a name no transpiled source can ever spell, so no
 * batched item's own bare symbol — `i`, `k`, or anything else — can collide with it again. */
export function wolframBatchCode(sources: readonly string[]): string {
  const list = sources.map((source) => JSON.stringify(source)).join(", ");
  const stable = `/. TestObject[a_Association] :> TestObject[KeyTake[a, {"Outcome", "Input", "ExpectedOutput", "ActualOutput"}]]`;
  // Held, `Rational[7, 2]` is a call, not the number, and prints as `\text{Rational}[7,2]`;
  // rewritten as the division and sum it stands for, it prints as written.
  const tex = `tex[x_] := StringReplace[ToString[Quiet[TeXForm[x]]], "\\n" -> " "]; atoms = {Rational -> Divide, Complex[0, 1] :> I, Complex[a_, 1] :> a + I, Complex[0, b_] :> b I, Complex[a_, b_] :> a + b I};`;
  return `${tex} Module[{k}, Do[Module[{v = Quiet[MemoryConstrained[TimeConstrained[ToExpression[{${list}}[[k]]], ${ITEM_SECONDS}, $Aborted], ${MAX_BYTES}, $Aborted]] ${stable}}, Print["<<", k, ">>", ToString[FullForm[v]]]; Print["<<", k, "#>>", ToString[FullForm[Quiet[TimeConstrained[N[v], ${ITEM_SECONDS}, v]]]]]; Print["<<", k, "|>>", ToString[InputForm[v]]]; If[NumberQ[Precision[v]], Print["<<", k, "~>>", ToString[NumberForm[v, ExponentFunction -> (Null &)]]]]; Print["<<", k, "^>>", tex[ToExpression[{${list}}[[k]], InputForm, HoldForm] /. atoms]]; Print["<<", k, "$>>", tex[v]]], {k, 1, ${sources.length}}]]`;
}

async function runWolfram(sources: readonly string[]): Promise<Result[]> {
  const run = await transcript("wolframscript", ["-code", wolframBatchCode(sources)], { timeoutMs: 600_000 });
  return "out" in run ? collectWolfram(run.out, sources.length) : failAll(sources.length, run.reason);
}

/** The Python source for one batch scan, as a pure string build — split out from `runPython`
 * so its shape (the per-item namespace, below) can be asserted on without a kernel.
 *
 * `for i, src in enumerate(sources)` at module level used to make `i` and `src` plain globals —
 * the same bug class #352 fixed for Wolfram's `Do` loop (wolframBatchCode): a batched item's
 * own bare name (a symbol literally named `i`, or a walrus target it assigns) landed in that
 * same shared namespace, visible to, and overwritable by, every item after it. Each item now
 * evaluates in its own copy (`_enumeratio_ns`) of a base namespace snapshotted right after the
 * preamble runs (`_enumeratio_base_ns`, before the loop's own bookkeeping names exist), so an
 * item's `eval`/`sage_eval` can neither read the loop's names nor leak one of its own into a
 * later item. */
export function pythonBatchCode(
  sources: readonly string[],
  preamble: string,
  evalExpr: (src: string, ns: string) => string = (src, ns) => `eval(${src}, ${ns})`,
  valueOf?: string,
): string {
  // With `valueOf`, the value line is that helper's rendering (compared) and a second
  // `|`-marked line carries the kernel's own form (displayed), as for Wolfram.
  const print = valueOf
    ? `v = ${evalExpr("_enumeratio_src", "_enumeratio_ns")}
        print("<<%d>>%s" % (_enumeratio_i + 1, ${valueOf}(v)), flush=True)
        print("<<%d|>>%s" % (_enumeratio_i + 1, str(v)), flush=True)`
    : `print("<<%d>>%s" % (_enumeratio_i + 1, str(${evalExpr("_enumeratio_src", "_enumeratio_ns")})), flush=True)`;
  return `${preamble}
_enumeratio_base_ns = dict(globals())
import json, signal, sys
print("<<0>>", flush=True)
def _timeout(signum, frame):
    raise TimeoutError("over ${ITEM_SECONDS}s")
signal.signal(signal.SIGALRM, _timeout)
_enumeratio_sources = json.loads(${JSON.stringify(JSON.stringify(sources))})
for _enumeratio_i, _enumeratio_src in enumerate(_enumeratio_sources):
    signal.alarm(${ITEM_SECONDS})
    _enumeratio_ns = dict(_enumeratio_base_ns)
    try:
        ${print}
    except BaseException as exc:
        print("<<%d>>!!%s" % (_enumeratio_i + 1, type(exc).__name__ + ": " + str(exc)[:100]), flush=True)
    finally:
        signal.alarm(0)
`;
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
  evalExpr?: (src: string, ns: string) => string,
  valueOf?: string,
): Promise<Result[]> {
  const program = pythonBatchCode(sources, preamble, evalExpr, valueOf);
  const run = await transcript("python3", [
    "-c",
    SUPERVISOR,
    String(MAX_BYTES),
    String(PYTHON_STALL_SECONDS),
    binary,
    ...args,
    program,
  ]);
  if (!("out" in run)) return failAll(sources.length, run.reason);
  return valueOf ? collectWolfram(run.out, sources.length) : collect(run.out, sources.length);
}

/** A Julia environment next to this package: `oscar/` for Oscar, `julia/` for Nemo +
 * Combinatorics.jl. Rationals print as floats so they compare numerically, as ours do; a
 * complex value prints in Python's `(a+bj)` spelling so compare.ts's existing Python-complex
 * parser (parsePython) reads it too, instead of Julia's own `a + bim`, which it does not. */
async function runJulia(
  sources: readonly string[],
  project: string,
  using: string,
  /** A Julia file of helpers the environment's emit templates call. */
  preamble?: string,
): Promise<Result[]> {
  // A JSON string is a Julia string literal once `$` stops interpolating.
  const list = sources.map((source) => JSON.stringify(source).replace(/\$/g, "\\$")).join(",\n");
  const program = `${juliaHeader(using, preamble)}
println("<<0>>"); flush(stdout)
for (i, src) in enumerate([${list}])
    try
        println("<<", i, ">>", show_oracle(Core.eval(Main, Meta.parse(src))))
    catch e
        println("<<", i, ">>!!", first(replace(sprint(showerror, e), '\\n' => ' '), 100))
    end
    flush(stdout)
end
`;
  // Julia has no per-item caps of its own, so the supervisor holds each item to its time and
  // memory (below the watchdog's cap), naming a runaway on its own rather than losing the
  // batch; `<<0>>` starts the clock once the packages have loaded.
  const limit = Math.floor(memoryCapMb() * 0.9) * 2 ** 20;
  const stall = String(2 * ITEM_SECONDS);
  const run = await withFile("batch.jl", program, (file) =>
    transcript("python3", ["-c", SUPERVISOR, String(limit), stall, "julia", ...juliaFlags(project), file]),
  );
  return "out" in run ? collect(run.out, sources.length) : failAll(sources.length, run.reason);
}

/** The lines every Julia program starts with: the packages, and how a value prints for the scan. */
const juliaHeader = (using: string, preamble?: string): string => `using ${using}
show_oracle(x) = string(x)
show_oracle(x::Rational) = string(Float64(x))
show_oracle(x::QQFieldElem) = string(Float64(x))
show_oracle(x::AbstractVector) = "[" * join(map(show_oracle, x), ", ") * "]"
show_oracle(x::Complex) = "(" * string(real(x)) * (imag(x) < 0 ? "-" : "+") * string(abs(imag(x))) * "j)"
${preamble === undefined ? "" : `include(${JSON.stringify(preamble)})`}`;

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
  const lines = sources.map((source, i) => `#eval IO.println ("<<${i + 1}>>" ++ toString (${source}))`);
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

const RUST_HEADER = ["#![allow(unused_parens, unused_imports)]", "use enumeratio_oracle::*;"];

/** Rust: every item of the batch as one closure in `rust/src/bin/batch.rs`, built against the
 * `rust/` crate's library (its adapters) and run. A panic costs its own item (`item` catches it); a compile
 * error would cost the whole batch, so an item rustc rejects is answered with its error and
 * the rest rebuilt without it. */
async function runRust(sources: readonly string[]): Promise<Result[]> {
  const crate = local("rust");
  const header = [...RUST_HEADER, "fn main() {"];
  const results: Result[] = failAll(sources.length, "no output");
  const live = new Set(sources.map((_, i) => i));
  for (let attempt = 0; attempt < sources.length + 1 && live.size > 0; attempt++) {
    const order = [...live];
    const lines = order.map((i) => `    item(${i + 1}, || ${sources[i]});`);
    mkdirSync(join(crate, "src", "bin"), { recursive: true });
    writeFileSync(join(crate, "src", "bin", "batch.rs"), [...header, ...lines, "}", ""].join("\n"));
    const build = await runBounded("cargo", ["build", "--quiet", "--message-format=short"], {
      cwd: crate,
      timeoutMs: 900_000,
    });
    if (build.killed !== undefined) return failAll(sources.length, `cargo: killed (${build.killed})`);
    if (build.code !== 0) {
      const rejected = new Map<number, string>();
      for (const match of build.stderr.matchAll(/src\/main\.rs:(\d+):\d+: error(?:\[\w+\])?: (.*)/g)) {
        const at = order[Number(match[1]) - header.length - 1];
        if (at !== undefined && !rejected.has(at)) rejected.set(at, `compile: ${(match[2] as string).slice(0, 90)}`);
      }
      if (rejected.size === 0) return failAll(sources.length, `cargo: ${build.stderr.slice(0, 120)}`);
      for (const [i, error] of rejected) {
        results[i] = { error };
        live.delete(i);
      }
      continue;
    }
    const run = await transcript(join(crate, "target", "debug", "batch"), [], {});
    if (!("out" in run)) return failAll(sources.length, run.reason);
    const got = collect(run.out, sources.length);
    for (const i of live) results[i] = got[i] as Result;
    break;
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

/** Like `collect`, plus the `<<n|>>` `InputForm` line as each value result's `display`,
 * the `<<n#>>` line as its `numeric`, and the `<<n^>>` / `<<n$>>` `TeXForm` lines as `tex`. */
export function collectWolfram(output: string, count: number): Result[] {
  const results = collect(output, count);
  const tex = new Map<number, { input: string; output: string }>();
  for (const line of output.split("\n")) {
    const match = /^<<(\d+)([|#^$~])>>(.*)$/.exec(line);
    if (match === null) continue;
    const index = Number(match[1]) - 1;
    const result = results[index];
    if (index < 0 || index >= count || result === undefined || !("value" in result)) continue;
    const text = (match[3] as string).trim();
    const marker = match[2];
    if (marker === "^" || marker === "$") {
      const pair = tex.get(index) ?? { input: "", output: "" };
      pair[marker === "^" ? "input" : "output"] = text;
      tex.set(index, pair);
    } else {
      const field = marker === "|" ? "display" : marker === "~" ? "shown" : "numeric";
      results[index] = { ...result, [field]: text };
    }
  }
  for (const [index, pair] of tex) {
    const result = results[index];
    if (result !== undefined && "value" in result) results[index] = { ...result, tex: pair };
  }
  return results;
}

// SymPy helpers: `stirling` lives outside `from sympy import *`, and an identity is decided by
// simplifying the difference, then numerically — `bool(Eq(…))` refuses anything it can't
// settle syntactically.
const SYMPY_PREAMBLE = `
from sympy.functions.combinatorial.numbers import stirling

def enumeratio_equal(a, b):
    try:
        d = a - b
        if simplify(d) == 0:
            return True
        # What simplify can't prove, 30 digits can still settle for a numeric identity.
        if d.is_number:
            return bool(abs(N(d, 30)) < 1e-20)
        return False
    except (TypeError, ValueError, AttributeError):
        return a == b

# Max/Min of a (possibly nested) list: Wolfram's Max/Min flatten every list argument into
# one pool, which SymPy's own Max/Min do not — handed a raw list they raise, since each of
# their *args must sympify to a comparable scalar, not a Python list.
def _enumeratio_flatten(x):
    if isinstance(x, (list, tuple)):
        out = []
        for e in x:
            out.extend(_enumeratio_flatten(e))
        return out
    return [x]

def enumeratio_max(*args):
    return Max(*_enumeratio_flatten(list(args)))

def enumeratio_min(*args):
    return Min(*_enumeratio_flatten(list(args)))

# Whether a and b, both possibly carrying a free symbol, are the same value — for
# symbolic.ts's symbolicAgreementSource. simplify(a - b) proves agreement outright when it
# can; failing that, trials is 3 (theirs, ours) pairs at fixed rational substitutions
# (already-evaluated, since symbolic.ts substitutes and re-emits before this call), skipped
# (None) where a trial's substitution didn't emit. None back means neither route decided.
def enumeratio_symbolic_agree(a, b, trials):
    try:
        d = simplify(a - b)
        if d == 0:
            return True
        if getattr(d, "free_symbols", None) == set() and getattr(d, "is_number", False):
            return bool(abs(N(d, 30)) < 1e-20)
    except (TypeError, ValueError, AttributeError):
        pass
    results = []
    for trial in trials:
        if trial is None:
            continue
        ta, tb = trial
        try:
            delta = complex(N(ta - tb, 30))
        except (TypeError, ValueError):
            continue
        results.append(abs(delta) < 1e-9)
    return all(results) if results else None
`;

// How SymPy and mpmath print a value for the scan: an exact integer or rational as it is, any
// other number (a SymPy closed form, an mpf, an mpc) as a Python float or complex literal —
// what parsePython reads — and anything else as the kernel prints it.
const PY_VALUE = `
def enumeratio_value(x):
    if isinstance(x, list):
        return "[" + ", ".join(enumeratio_value(e) for e in x) + "]"
    if isinstance(x, (bool, int, str, tuple)) or x is None:
        return str(x)
    try:
        import sympy
        if isinstance(x, sympy.Basic):
            if x.is_Rational:
                return str(x)
            if not x.is_number:
                return str(x)
            x = x.evalf(30)
    except ImportError:
        pass
    try:
        import sympy
        named = {sympy.zoo: "ComplexInfinity", sympy.oo: "PositiveInfinity", -sympy.oo: "NegativeInfinity", sympy.nan: "NaN"}
        if isinstance(x, sympy.Basic) and x in named:
            return named[x]
    except ImportError:
        pass
    try:
        z = complex(x)
    except (TypeError, ValueError, OverflowError):
        return str(x)
    import math
    # Non-finite values by the names ours uses.
    if math.isnan(z.real) or math.isnan(z.imag):
        return "NaN"
    if math.isinf(z.real) and z.imag == 0:
        # A finite value past the double range (gamma(200.5)) keeps its own digits.
        text = str(x)
        if "inf" not in text.lower() and text.strip("-") != "oo":
            return text
        return "PositiveInfinity" if z.real > 0 else "NegativeInfinity"
    if z.imag == 0:
        return repr(z.real)
    return "(" + repr(z.real) + ("+" if z.imag >= 0 else "-") + repr(abs(z.imag)) + "j)"
`;

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

# Adeles (Hertogh's package, github.com/mathehertogh/adeles): the is_* helpers Sage 10.9
# removed, revived the same way packages/symbols/arithmetic/adeles/scripts/collect-golden.py
# revives them, so ProfiniteNumber/Idele/Adele's mapped rows below can import and use it.
# Guarded: a Sage without the adeles package (a plain image, a local run) still runs
# every other mapped call; only the adeles rows would then error.
try:
    import sage.rings.number_field.number_field as _enumeratio_nf
    import sage.rings.number_field.number_field_element as _enumeratio_nfe
    import sage.rings.number_field.number_field_ideal as _enumeratio_nfi
    import sage.rings.quotient_ring as _enumeratio_qr
    from sage.rings.number_field.number_field_base import NumberField as _EnumeratioNumberField

    _enumeratio_nf.is_NumberField = lambda K: isinstance(K, _EnumeratioNumberField)
    _enumeratio_nfi.is_NumberFieldIdeal = lambda x: isinstance(x, _enumeratio_nfi.NumberFieldFractionalIdeal)
    _enumeratio_nfe.is_NumberFieldElement = lambda x: isinstance(x, _enumeratio_nfe.NumberFieldElement)
    _enumeratio_qr.is_QuotientRing = lambda x: isinstance(x, _enumeratio_qr.QuotientRing_generic)

    from adeles.all import Adeles, Ideles, Qhat  # noqa: E402
    from adeles.matrix import factor_GLQhat  # noqa: E402
except ImportError:
    pass

# Qhat/Idele/Adele are foreign objects with no str() that means what we mean -- these mirror
# collect-golden.py's own num()/profinite()/idele() conversions into our MathJSON shape, the
# same reason that script has them.
def _enumeratio_adic_int(n):
    n = int(n)
    return n if abs(n) < 2**53 else {"num": str(n)}

def _enumeratio_adic_num(x):
    x = QQ(x)
    if x.denominator() == 1:
        return _enumeratio_adic_int(x.numerator())
    return ["Rational", _enumeratio_adic_int(x.numerator()), _enumeratio_adic_int(x.denominator())]

def _enumeratio_profinite_json(z):
    if z.modulus() == 0:
        return _enumeratio_adic_num(z.value())
    return ["ProfiniteNumber", _enumeratio_adic_num(z.value()), _enumeratio_adic_num(z.modulus())]

def _enumeratio_idele_json(u):
    r = _enumeratio_adic_num(u.infinite_part()[0].center())
    if u.has_exact_finite_part():
        return ["Idele", r, _enumeratio_adic_num(u.finite_part())]
    # The units-list branch: an AdicNumeral per listed prime. AdicNumeral has no sage binding
    # (packages/symbols/arithmetic/numerals' own lane), so this branch only matters for a
    # RESULT we are printing back, never for emitting one of our own examples as sage source.
    scale, units = QQ(1), []
    for p in sorted(u.stored_primes()):
        c, n = u[p].center(), u[p].prec()
        v = c.valuation(p)
        scale *= QQ(p) ** v
        unit = c / QQ(p) ** v
        if n == Infinity:
            units.append(["AdicNumeral", int(p), _enumeratio_adic_num(unit)])
        elif n > (1 if p == 2 else 0):
            m = int(p) ** int(n)
            units.append(["AdicNumeral", int(p), int(mod(unit, m).lift()), int(n)])
    return ["Idele", r, _enumeratio_adic_num(scale), ["List", *units]]

def _enumeratio_adele_json(a):
    return ["Adele", _enumeratio_adic_num(a.infinite_part()[0].center()), _enumeratio_profinite_json(a.finite_part())]

def _enumeratio_is_adeles_object(x):
    return getattr(type(x), "__module__", "").startswith("adeles.")

def _enumeratio_adeles_json(x):
    if hasattr(x, "has_exact_finite_part"):
        return _enumeratio_idele_json(x)
    if hasattr(x, "finite_part") and hasattr(x, "infinite_part"):
        return _enumeratio_adele_json(x)
    return _enumeratio_profinite_json(x)

# ProfiniteDecomposition(m, d): Hertogh's Algorithm 8.4, factor_GLQhat -- no one-liner since it
# needs the matrix built from $1's nested List first. Returns the JSON text directly (not a
# plain value) so enumeratio_value's fallthrough (a str it cannot interpret further) hands it
# back unchanged.
# A's entries are compared the way compute-engine's own leaf() (oracle-verdict.ts) reduces a
# bare Rational -- a decimal NUMBER, not a structured ["Rational", n, d] -- since the whole
# decomposition answer is one flat text comparison (compare.ts), not a per-leaf one; there is no
# tolerance step to paper over a quoted string or a stray ["Rational", ...] here. json.dumps on a
# plain int/float keeps the digits unquoted so they line up with show()'s String(x).
def _enumeratio_bare_num(x):
    import json
    x = QQ(x)
    return json.dumps(int(x)) if x.denominator() == 1 else repr(float(x))

def enumeratio_profinite_decomposition(rows, d):
    import json
    n = len(rows)
    M = matrix(Qhat, n, n, [rows[i][j] for i in range(n) for j in range(n)])
    A = factor_GLQhat(M, d)
    B = M * A.inverse().change_ring(Qhat)
    row = lambda cells: "[" + ", ".join(cells) + "]"
    b_text = row([row([json.dumps(_enumeratio_profinite_json(B[i, j])) for j in range(n)]) for i in range(n)])
    a_text = row([row([_enumeratio_bare_num(A[i, j]) for j in range(n)]) for i in range(n)])
    return row([b_text, a_text])

def enumeratio_value(x):
    import json
    if _enumeratio_is_adeles_object(x):
        return json.dumps(_enumeratio_adeles_json(x))
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
        if z.imag() == 0:
            return repr(float(z.real()))
        # A complex as a Python literal, which parsePython reads (as for SymPy and mpmath).
        re, im = float(z.real()), float(z.imag())
        return "(" + repr(re) + ("+" if im >= 0 else "-") + repr(abs(im)) + "j)"
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

# Sage's own version of the SymPy helper above (run.ts, SYMPY_PREAMBLE): simplify_full() of
# the difference proves agreement outright when it can, else the fixed-rational trials decide.
def enumeratio_symbolic_agree(a, b, trials):
    try:
        d = (a - b).simplify_full()
        if bool(d == 0):
            return True
    except (TypeError, ValueError, AttributeError):
        pass
    results = []
    for trial in trials:
        if trial is None:
            continue
        ta, tb = trial
        try:
            delta = CC(ta - tb)
        except (TypeError, ValueError):
            continue
        results.append(abs(delta) < 1e-9)
    return all(results) if results else None
`;

export interface Prelude {
  readonly binary: string;
  readonly preamble: string;
  readonly evaluate?: (source: string) => string;
  readonly printer?: string;
  readonly project?: string;
}

/**
 * What a program for `system` has to start with so emitted sources mean what they mean in a
 * scan: imports, helpers and value printers. `evaluate` wraps a source string for the Python
 * family (Sage's preparser only runs through `sage_eval`); `printer` names the printer the scan
 * compares with. For the benchmark harnesses (`@enumeratio/bench`), which must run the same
 * sources the same way.
 */
export function preludeFor(system: System): Prelude {
  switch (system) {
    case "wolfram":
      return { binary: "wolframscript", preamble: "" };
    case "sympy":
      return {
        binary: "python3",
        preamble: `from sympy import *\n${SYMPY_PREAMBLE}\n${PY_VALUE}`,
        printer: "enumeratio_value",
      };
    case "mpmath":
      return {
        binary: "python3",
        preamble: `from mpmath import *\nmp.dps = 30\n${PY_VALUE}`,
        printer: "enumeratio_value",
      };
    case "sage":
      return {
        binary: "sage",
        preamble: `from sage.misc.sage_eval import sage_eval\n${SAGE_PREAMBLE}`,
        evaluate: (src) => `sage_eval(${src}, locals=globals())`,
        printer: "enumeratio_value",
      };
    case "oscar":
      return {
        binary: "julia",
        preamble: juliaHeader("Oscar", join(local("oscar"), "preamble.jl")),
        printer: "show_oracle",
        project: local("oscar"),
      };
    case "julia":
      return {
        binary: "julia",
        preamble: juliaHeader("Nemo, Combinatorics"),
        printer: "show_oracle",
        project: local("julia"),
      };
    case "mathlib4":
      return {
        binary: "lake",
        preamble: [...LEAN_IMPORTS.map((module) => `import ${module}`), "open Nat"].join("\n"),
      };
    case "rust":
      return { binary: "cargo", preamble: RUST_HEADER.join("\n"), project: local("rust") };
    default:
      throw new Error("unreachable: System is exhaustive above");
  }
}

export interface RunOptions {
  /** Epoch ms after which the items not yet started are answered `TimeoutError`, not run. */
  readonly deadline?: number;
}

/** Seconds between progress lines on stderr, so a stalled lane is visible in a CI log. */
const PROGRESS_SECONDS = 30;

export async function runIn(system: System, sources: readonly string[], options: RunOptions = {}): Promise<Result[]> {
  const results: Result[] = [];
  let start = 0;
  const began = Date.now();
  let reported = began;
  while (start < sources.length) {
    if (options.deadline !== undefined && Date.now() > options.deadline) {
      const spent = { error: "TimeoutError: lane budget spent" };
      while (results.length < sources.length) results.push(spent);
      break;
    }
    const batch = await runBatch(system, sources.slice(start, start + BATCH));
    // A kernel that died mid-batch leaves "no output" after the item that killed it.
    const lost = batch.findIndex((r) => "error" in r && r.error === "no output");
    // Nothing came back at all: count the first item as the culprit and move past it.
    const kept = lost === 0 ? [{ error: "kernel died before answering" }] : lost > 0 ? batch.slice(0, lost) : batch;
    results.push(...kept);
    start += kept.length;
    if (Date.now() - reported >= PROGRESS_SECONDS * 1000 || start >= sources.length) {
      reported = Date.now();
      process.stderr.write(`${system}: ${start}/${sources.length} (${Math.round((reported - began) / 1000)}s)\n`);
    }
  }
  return results;
}

function runBatch(system: System, sources: readonly string[]): Promise<Result[]> {
  switch (system) {
    case "wolfram":
      return runWolfram(sources);
    case "sympy":
      return runPython(
        sources,
        "python3",
        `from sympy import *\n${SYMPY_PREAMBLE}\n${PY_VALUE}`,
        ["-c"],
        undefined,
        "enumeratio_value",
      );
    case "mpmath":
      return runPython(
        sources,
        "python3",
        `from mpmath import *\nmp.dps = 30\n${PY_VALUE}`,
        ["-c"],
        undefined,
        "enumeratio_value",
      );
    case "sage":
      // `sage -c` takes one program string, like python3 -c. `locals=<per-item ns>` is what
      // lets `sage_eval` see SAGE_PREAMBLE's helpers (copied into that namespace from the
      // module globals snapshotted right after the preamble runs) without also seeing the
      // batch loop's own bookkeeping names.
      return runPython(
        sources,
        "sage",
        `from sage.misc.sage_eval import sage_eval\n${SAGE_PREAMBLE}`,
        ["-c"],
        (src, ns) => `sage_eval(${src}, locals=${ns})`,
        "enumeratio_value",
      );
    case "oscar":
      return runJulia(sources, "oscar", "Oscar", join(local("oscar"), "preamble.jl"));
    case "julia":
      return runJulia(sources, "julia", "Nemo, Combinatorics");
    case "mathlib4":
      return runLean(sources);
    case "rust":
      return runRust(sources);
    default:
      throw new Error("unreachable: System is exhaustive above");
  }
}
