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
import { type Bounds, memoryCapMb, runBounded } from "@enumeratio/utils/bounded";
import type { System } from "./systems.ts";
/** Sources per kernel process. */
const BATCH = 40;
/** Seconds one item may run before it counts as an error, unless a run says otherwise (`RunOptions`). */
export const ITEM_SECONDS = 30;
/** Seconds a Python kernel may print nothing before the supervisor kills it: twice the item cap.
 * SIGALRM only lands between bytecodes, so a C-level call (a huge integer power) outlives the cap. */
const stallSeconds = (itemSeconds: number): number => 2 * itemSeconds;
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
export function wolframBatchCode(sources: readonly string[], itemSeconds: number = ITEM_SECONDS): string {
  // wolframscript reads `-code` byte by byte (`∑` arrives as three Latin-1 characters), so a
  // non-ASCII character goes in as Wolfram's own escape: `\:2211`, or `\|01f600` past the BMP.
  const escaped = (source: string): string =>
    JSON.stringify(source).replace(/\P{ASCII}/gu, (ch) => {
      const code = ch.codePointAt(0) as number;
      return code > 0xffff ? `\\|${code.toString(16).padStart(6, "0")}` : `\\:${code.toString(16).padStart(4, "0")}`;
    });
  const list = sources.map(escaped).join(", ");
  const stable = `/. TestObject[a_Association] :> TestObject[KeyTake[a, {"Outcome", "Input", "ExpectedOutput", "ActualOutput"}]]`;
  // Held, `Rational[7, 2]` is a call, not the number, and prints as `\text{Rational}[7,2]`;
  // rewritten as the division and sum it stands for, it prints as written.
  const tex = `tex[x_] := StringReplace[ToString[Quiet[TeXForm[x]]], "\\n" -> " "]; atoms = {Rational -> Divide, Complex[0, 1] :> I, Complex[a_, 1] :> a + I, Complex[0, b_] :> b I, Complex[a_, b_] :> a + b I};`;
  return `${tex} Module[{k}, Do[Module[{v = Quiet[MemoryConstrained[TimeConstrained[ToExpression[{${list}}[[k]]], ${itemSeconds}, $Aborted], ${MAX_BYTES}, $Aborted]] ${stable}}, Print["<<", k, ">>", ToString[FullForm[v]]]; Print["<<", k, "#>>", ToString[FullForm[Quiet[TimeConstrained[N[v], ${itemSeconds}, v]]]]]; Print["<<", k, "|>>", ToString[InputForm[v]]]; If[NumberQ[Precision[v]], Print["<<", k, "~>>", ToString[NumberForm[v, ExponentFunction -> (Null &)]]]]; Print["<<", k, "^>>", tex[ToExpression[{${list}}[[k]], InputForm, HoldForm] /. atoms]]; Print["<<", k, "$>>", tex[v]]], {k, 1, ${sources.length}}]]`;
}

async function runWolfram(sources: readonly string[], itemSeconds: number): Promise<Result[]> {
  const run = await transcript("wolframscript", ["-code", wolframBatchCode(sources, itemSeconds)], {
    timeoutMs: Math.max(600_000, itemSeconds * 20_000),
  });
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
  itemSeconds: number = ITEM_SECONDS,
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
    raise TimeoutError("over ${itemSeconds}s")
signal.signal(signal.SIGALRM, _timeout)
_enumeratio_sources = json.loads(${JSON.stringify(JSON.stringify(sources))})
for _enumeratio_i, _enumeratio_src in enumerate(_enumeratio_sources):
    signal.alarm(${itemSeconds})
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
  itemSeconds: number = ITEM_SECONDS,
): Promise<Result[]> {
  const program = pythonBatchCode(sources, preamble, evalExpr, valueOf, itemSeconds);
  const run = await transcript("python3", [
    "-c",
    SUPERVISOR,
    String(MAX_BYTES),
    String(stallSeconds(itemSeconds)),
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
  preamble: string | undefined,
  itemSeconds: number,
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
  const stall = String(stallSeconds(itemSeconds));
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

// Whether the kernel's value `a` is the call ours holds, `held` being ours' source text (never
// evaluated, or a kernel that computes where ours holds would agree with itself). Equal as Python
// expressions, so spacing, redundant parentheses, a symbol's constructor, a helper's prefix and Sage's sgn for sign don't matter; else the
// marker that sends the row to the plain comparison.
const HELD_ALIKE = `
def enumeratio_held_alike(a, held):
    import ast, re
    def parsed(text):
        text = re.sub(r'(?:Symbol|SR\\.var)\\("([A-Za-z_0-9]+)"\\)', r'\\1', text)
        text = re.sub(r'\\bsgn\\(', 'sign(', text.replace("enumeratio_", ""))
        try:
            tree = ast.parse(text.strip(), mode="eval")
        except SyntaxError:
            return " ".join(text.split())
        # SymPy prints x % 2 held as Mod(x, 2).
        class Mod(ast.NodeTransformer):
            def visit_BinOp(self, node):
                self.generic_visit(node)
                if isinstance(node.op, ast.Mod):
                    return ast.Call(func=ast.Name(id="Mod", ctx=ast.Load()), args=[node.left, node.right], keywords=[])
                return node
        return ast.dump(Mod().visit(tree))
    return True if parsed(str(a)) == parsed(held) else "NotNumeric"
`;

// SymPy helpers: `stirling` lives outside `from sympy import *`, and an identity is decided by
// simplifying the difference, then numerically — `bool(Eq(…))` refuses anything it can't
// settle syntactically.
export const SYMPY_PREAMBLE = `
from sympy.functions.combinatorial.numbers import stirling

${HELD_ALIKE}
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
    # Lists agree element by element: False if any pair is, True only if every pair is.
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        verdicts = []
        for i in range(len(a)):
            sub = []
            for trial in trials:
                try:
                    sub.append(None if trial is None else (trial[0][i], trial[1][i]))
                except (TypeError, IndexError):
                    sub.append(None)
            verdicts.append(enumeratio_symbolic_agree(a[i], b[i], sub))
        if any(v is False for v in verdicts):
            return False
        return True if all(v is True for v in verdicts) else None
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
// Arithmetic over lists, element by element, as compute-engine and Wolfram do; the emitted
// call carries the scalar operation as a lambda. Lists of different lengths raise.
const PY_BROADCAST = `
def enumeratio_broadcast(f, *args):
    lists = [a for a in args if isinstance(a, list)]
    if not lists:
        return f(*args)
    if any(len(a) != len(lists[0]) for a in lists):
        raise ValueError("lists of different lengths")
    return [enumeratio_broadcast(f, *[a[i] if isinstance(a, list) else a for a in args]) for i in range(len(lists[0]))]
`;

const PY_VALUE = `
import sys
# An exact power like 2**1000000 prints in full: the default 4300-digit cap on int-to-str raises.
if hasattr(sys, "set_int_max_str_digits"):
    sys.set_int_max_str_digits(0)

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

${HELD_ALIKE}
# A Gaussian integer a + bi (b != 0) written as a symbolic-ring number has no gcd, divisors or
# factorization there; ZZ[I] does. Anything that is not an exact Gaussian integer comes back
# unchanged.
def enumeratio_gi(x):
    try:
        re, im = x.real(), x.imag()
        if im != 0:
            return GaussianIntegers()([ZZ(re), ZZ(im)])
    except (AttributeError, TypeError, ValueError):
        pass
    return x

def _enumeratio_is_gi(x):
    return hasattr(x, "parent") and x.parent() is GaussianIntegers()

# Gaussian integers are defined up to a unit; compute-engine and Wolfram write each in the first
# quadrant (Re > 0, Im >= 0), and so do these. The unit that took g there comes back with it.
def _enumeratio_first_quadrant(g):
    G = GaussianIntegers()
    if g == 0:
        return g, G(1)
    for k in range(4):
        u = G([0, 1]) ** k
        h = g * u
        if h.real() > 0 and h.imag() >= 0:
            return h, u
    return g, G(1)

# A Gaussian result in the first quadrant; any other value as it is.
def _enumeratio_associate(g):
    return _enumeratio_first_quadrant(g)[0] if _enumeratio_is_gi(g) else g

# Sage defines no \`%\` on ZZ[I] or on the symbolic ring. Mod is a - b * floor(a / b); over ZZ[I]
# the quotient is rounded to the nearest Gaussian integer, ties to even, as Round does.
def _enumeratio_round_half_even(x):
    n = floor(x)
    d = x - n
    return n + 1 if d > 1 / 2 or (d == 1 / 2 and n % 2 == 1) else n

def _enumeratio_mod(a, b):
    a, b = enumeratio_gi(a), enumeratio_gi(b)
    if _enumeratio_is_gi(a) or _enumeratio_is_gi(b):
        G = GaussianIntegers()
        a, b = G(a), G(b)
        z = a / b
        return a - G([_enumeratio_round_half_even(z.real()), _enumeratio_round_half_even(z.imag())]) * b
    # Sage has no remainder on the symbolic ring, and none is made up here: its own TypeError stands.
    if not (_enumeratio_is_numeric(a) and _enumeratio_is_numeric(b)):
        return a % b
    # Only integers take the integer \`%\`: for 4.0 it is centered, where Mod is a - b * floor(a / b).
    if isinstance(a, (Integer, int)) and isinstance(b, (Integer, int)):
        return a % b
    return a - b * floor(a / b)

def enumeratio_mod(a, b):
    return enumeratio_broadcast(_enumeratio_mod, a, b)

def _enumeratio_gcd(a, b):
    return _enumeratio_associate(gcd(enumeratio_gi(a), enumeratio_gi(b)))

def enumeratio_gcd(a, b):
    return enumeratio_broadcast(_enumeratio_gcd, a, b)

# lcm has no ZZ[I] method: a * b / gcd(a, b).
def _enumeratio_lcm(a, b):
    a, b = enumeratio_gi(a), enumeratio_gi(b)
    G = GaussianIntegers()
    if _enumeratio_is_gi(a) or _enumeratio_is_gi(b):
        a, b = G(a), G(b)
        return G(0) if a == 0 or b == 0 else _enumeratio_associate(G(a * b / gcd(a, b)))
    return lcm(a, b)

def enumeratio_lcm(a, b):
    return enumeratio_broadcast(_enumeratio_lcm, a, b)

# Divisors over ZZ[I]: each in the first quadrant, once, in order of real part then imaginary part.
def _enumeratio_divisors(n):
    n = enumeratio_gi(n)
    if not _enumeratio_is_gi(n):
        return divisors(n)
    G = GaussianIntegers()
    found = {_enumeratio_associate(G(d)) for d in divisors(n)}
    return sorted(found, key=lambda d: (d.real(), d.imag()))

def enumeratio_divisors(n):
    return enumeratio_broadcast(_enumeratio_divisors, n)

# FactorInteger lists the unit first when it is not 1 (-1 over ZZ; -1, i or -i over ZZ[I]); the
# primes of ZZ[I] sit in the first quadrant, by norm and then real part. 1 and 0 are their own factor.
def _enumeratio_factor_integer(n):
    n = enumeratio_gi(n)
    if n == 1 or n == 0:
        return [(n, 1)]
    f = factor(n)
    if not _enumeratio_is_gi(n):
        unit = f.unit()
        return ([(unit, 1)] if unit != 1 else []) + [(p, e) for p, e in f]
    unit, primes = f.unit(), []
    for p, e in f:
        q, w = _enumeratio_first_quadrant(p)
        unit = unit * w.inverse_of_unit() ** e
        primes.append((q, e))
    primes.sort(key=lambda t: (t[0].norm(), t[0].real()))
    return ([(unit, 1)] if unit != 1 else []) + primes

def enumeratio_factor_integer(n):
    return enumeratio_broadcast(_enumeratio_factor_integer, n)

# The residue Wolfram answers for an inverse modulo m: the parts in [0, m) (the sign of m) when m
# is real, else the remainder of the nearest-quotient division.
def _enumeratio_inverse_mod(a, m):
    a, m = enumeratio_gi(a), enumeratio_gi(m)
    if not (_enumeratio_is_gi(a) or _enumeratio_is_gi(m)):
        return inverse_mod(a, m) % m
    G = GaussianIntegers()
    a, m = G(a), G(m)
    r = G(inverse_mod(a, m))
    if m.imag() == 0:
        k = ZZ(m.real())
        return G([ZZ(r.real()) % k, ZZ(r.imag()) % k])
    return _enumeratio_mod(r, m)

def enumeratio_inverse_mod(a, m):
    return enumeratio_broadcast(_enumeratio_inverse_mod, a, m)

# a^e mod m by squaring, over ZZ[I] where Sage has no power_mod: a negative exponent inverts first.
# Wolfram's residue is in the sign of m (as \`%\` is), so an exponent of 0 gives 1 mod m.
def _enumeratio_power_mod(a, e, m):
    a, m = enumeratio_gi(a), enumeratio_gi(m)
    if not (_enumeratio_is_gi(a) or _enumeratio_is_gi(m)):
        return power_mod(a, e, m) % m
    G = GaussianIntegers()
    a, m = G(a), G(m)
    if e < 0:
        a, e = G(_enumeratio_inverse_mod(a, m)), -e
    result, base = G(1), a
    while e > 0:
        if e % 2 == 1:
            result = G(_enumeratio_mod(result * base, m))
        base = G(_enumeratio_mod(base * base, m))
        e //= 2
    reduced = _enumeratio_mod(result, m)
    # A real residue reads like an integer's: into [0, m) in the sign of m, not centered.
    if reduced.imag() == 0 and m.imag() == 0:
        return ZZ(reduced.real()) % ZZ(m.real())
    return reduced

def enumeratio_power_mod(a, e, m):
    return enumeratio_broadcast(_enumeratio_power_mod, a, e, m)

# A number, not an expression in a variable or an unevaluated call of a function of its own (f(2)).
def _enumeratio_is_numeric(x):
    if hasattr(x, "variables") and x.variables():
        return False
    if hasattr(x, "operator"):
        from sage.symbolic.function import SymbolicFunction
        return not isinstance(x.operator(), SymbolicFunction) and all(_enumeratio_is_numeric(o) for o in x.operands())
    return True

# The bits of the least precise inexact number x holds (a float, an RR or CC element, a numeric
# leaf of an expression), or None for an exact value: an inexact operand has no more bits to give.
def _enumeratio_bits(x):
    from sage.rings.real_mpfr import RealNumber
    from sage.rings.complex_mpfr import ComplexNumber
    if isinstance(x, (float, complex)):
        return 53
    if isinstance(x, (RealNumber, ComplexNumber)):
        return x.prec()
    if not hasattr(x, "operands"):
        return None
    if x.is_numeric():
        return _enumeratio_bits(x.pyobject())
    found = [b for b in map(_enumeratio_bits, x.operands()) if b is not None]
    return min(found) if found else None

# N at the precision the value needs: Sage rounds an exact argument to 53 bits first, so cos(10^100)
# comes out wrong. Raise the precision until two evaluations agree to 2^-40; a symbolic expression
# stays as it is, as in Wolfram. The digit count only sets the starting precision, because the lanes
# compare numbers to a relative tolerance.
def _enumeratio_n(x, digits=None):
    if not _enumeratio_is_numeric(x):
        return x
    # {precision, accuracy}: the accuracy counts digits after the point, so a value of magnitude
    # 10^k has k + 1 + accuracy significant ones.
    accuracy = None
    if isinstance(digits, (list, tuple)):
        accuracy, digits = digits[1], None
    start = 53 if digits is None or digits <= 15 else int(digits * 3.33) + 20
    bits = _enumeratio_bits(x)
    if bits is not None:
        v = N(x, prec=min(start, bits))
        # Its digits are all it has, so asking for fewer does not round them away.
        digits = None
    else:
        previous = None
        for prec in (start, start * 8, start * 64):
            v = N(x, prec=prec)
            if previous is not None and abs(v - previous) <= abs(v) * 2 ** -40:
                break
            previous = v
    if accuracy is not None and v != 0:
        digits = max(int(accuracy + floor(log(abs(v), 10)) + 1), 1)
    return _enumeratio_digits(v, digits)

# A numeric value at the digits asked for (ties to even, as N does) or, with none, as a double: a
# value at thousands of bits would print in full.
def _enumeratio_digits(v, digits):
    def part(r):
        r = RealField(53)(r)
        return RealField(53)(r.str(digits=digits)) if digits is not None and digits <= 15 else r
    if hasattr(v, "imag") and v.imag() != 0:
        return ComplexField(53)(part(v.real()), part(v.imag()))
    return part(v.real() if hasattr(v, "real") else v)

def enumeratio_n(x, digits=None):
    return enumeratio_broadcast(lambda v: _enumeratio_n(v, digits), x)

# Equal as the identity ours checks: Sage's == compares forms (log(2) + log(3) == log(6) is False),
# so a difference it cannot reduce to 0 is sampled at three exact points (one positive, one negative,
# one complex) when it holds a variable, and never trusted to a simplifier that assumes reals
# (abs(x)^2 == x^2). Exact operands agree to a relative 2^-150 of their size (so exp(-200) != 0);
# an inexact operand (a float, or a float in an expression) to a relative 1e-12, as Wolfram's Equal does.
# A point where an operand is undefined is skipped; no point at all is an error, not a verdict.
def _enumeratio_at(v, point):
    return v.subs(point) if point and hasattr(v, "subs") else v

def _enumeratio_sample(j, i):
    t = QQ(8137) * i / 10000
    return [QQ(37) / 100 + t, -(QQ(19) / 10 + t), QQ(37) / 100 + t + (QQ(61) / 100 + t) * I][j]

def _enumeratio_equal(a, b):
    try:
        if bool(a == b):
            return True
    except (TypeError, ValueError):
        pass
    # Without a difference (an idele) == was the whole test.
    try:
        d = a - b
    except TypeError:
        return False
    names = d.variables() if hasattr(d, "variables") else ()
    if not names and hasattr(d, "simplify_full") and d.simplify_full() == 0:
        return True
    approximate = _enumeratio_bits(a) is not None or _enumeratio_bits(b) is not None
    agreed = []
    for j in range(3) if names else [0]:
        point = {v: _enumeratio_sample(j, i) for i, v in enumerate(names)}
        try:
            value = _enumeratio_at(d, point)
            if approximate:
                scale = max(abs(CC(_enumeratio_at(a, point))), abs(CC(_enumeratio_at(b, point))), 1e-300)
                agreed.append(abs(CC(value)) <= scale * 1e-12)
            else:
                C = ComplexField(300)
                scale = max(abs(C(N(_enumeratio_at(a, point), prec=300))), abs(C(N(_enumeratio_at(b, point), prec=300))))
                agreed.append(abs(C(N(value, prec=300))) <= scale * 2 ** -150)
        except (ArithmeticError, ValueError):
            continue
        except TypeError:
            # A difference with no variable and no numeric value (a profinite number): == was the whole test.
            if names:
                raise
            return False
    if not agreed:
        raise ValueError("no sample point could be evaluated")
    return all(agreed)

def enumeratio_equal(a, b):
    return _enumeratio_equal(a, b)

# Zeta[s, a] sums ((n + a)^2)^(-s/2) over n >= 0 and skips n + a = 0, where Sage's hurwitz_zeta
# continues (n + a)^(-s) and meets a pole at a nonpositive integer. For a rational a <= 0 the
# terms before n + a turns positive are added by hand and hurwitz_zeta takes the rest.
def _enumeratio_zeta_pair(s, a):
    if getattr(a, "parent", lambda: None)() in (ZZ, QQ) and a <= 0:
        m = ceil(-a)
        if m > 10000:
            raise ValueError("too many terms before the sum turns positive")
        b = a + m
        head = sum(((n + a) ** 2) ** (-s / 2) for n in range(m))
        # n + a = 0 is skipped, except that 0^0 is 1 at s = 0.
        if b == 0:
            return head + (1 if s == 0 else 0) + hurwitz_zeta(s, 1)
        return head + hurwitz_zeta(s, b)
    return hurwitz_zeta(s, a)

def enumeratio_zeta_pair(s, a):
    return enumeratio_broadcast(_enumeratio_zeta_pair, s, a)

# A factorial passes an infinity through and threads over a list.
def enumeratio_factorial(n):
    return enumeratio_broadcast(lambda v: v if str(v) == "+Infinity" else factorial(v), n)

# Length counts operands: a string is an atom, a list its entries, a symbolic expression its .operands().
def enumeratio_length(x):
    if isinstance(x, str):
        return 0
    if hasattr(x, "__len__"):
        return len(x)
    if hasattr(x, "operands"):
        return len(x.operands())
    return 0

# Sign of a complex number is z / |z|, as in Wolfram; Sage leaves sgn(z) held.
def _enumeratio_sign(x):
    try:
        if _enumeratio_is_numeric(x) and x.imag() != 0:
            return x / abs(x)
    except (AttributeError, TypeError, ValueError):
        pass
    return sign(x)

def enumeratio_sign(x):
    return enumeratio_broadcast(_enumeratio_sign, x)

# Floor and Ceiling of a complex number act on its real and imaginary parts, as in Wolfram; an infinity or NaN
# passes through, where Sage raises.
def _enumeratio_round_parts(f, x):
    if str(x) in ("+Infinity", "-Infinity", "Infinity", "NaN"):
        return x
    try:
        if _enumeratio_is_numeric(x) and x.imag() != 0:
            return f(x.real()) + I * f(x.imag())
    except (AttributeError, TypeError, ValueError):
        pass
    return f(x)

def enumeratio_floor(x):
    return enumeratio_broadcast(lambda v: _enumeratio_round_parts(floor, v), x)

def enumeratio_ceil(x):
    return enumeratio_broadcast(lambda v: _enumeratio_round_parts(ceil, v), x)

# |z| is never negative: the unsigned infinity has the magnitude +Infinity.
def _enumeratio_abs(x):
    r = abs(x)
    return oo if str(r) == "Infinity" else r

def enumeratio_abs(x):
    return enumeratio_broadcast(_enumeratio_abs, x)

# PrimeQ and EulerPhi take the magnitude of a negative integer: -7 is prime, phi(-10) = phi(10).
def _enumeratio_magnitude(n):
    n = enumeratio_gi(n)
    return n if _enumeratio_is_gi(n) or n not in ZZ else abs(n)

def enumeratio_is_prime(n):
    return enumeratio_broadcast(lambda v: is_prime(_enumeratio_magnitude(v)), n)

def enumeratio_euler_phi(n):
    return enumeratio_broadcast(lambda v: euler_phi(_enumeratio_magnitude(v)), n)

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
    if isinstance(x, tuple):
        return "(" + ", ".join(repr(e) if isinstance(e, str) else enumeratio_value(e) for e in x) + ("," if len(x) == 1 else "") + ")"
    if isinstance(x, (bool, int)):
        return str(x)
    # The infinities and NaN by the names ours uses, as PY_VALUE does for SymPy and mpmath: Sage
    # prints +oo as +Infinity and the unsigned infinity as Infinity, which text comparison
    # cannot line up with ours.
    named = {"+Infinity": "PositiveInfinity", "-Infinity": "NegativeInfinity", "Infinity": "ComplexInfinity", "NaN": "NaN"}
    if str(x) in named:
        return named[str(x)]
    # Nothing decided prints as nothing: CC(None) would be 0.0.
    if x is None:
        return "None"
    # A residue class keeps its modulus, as ours does; CC would turn it into a float.
    from sage.rings.finite_rings.integer_mod import IntegerMod_abstract
    if isinstance(x, IntegerMod_abstract):
        return "ResidueClass(%s, %s)" % (x.lift(), x.modulus())
    try:
        if x in QQ:
            return str(x)
        z = CC(x)
        if z.imag() == 0:
            re = float(z.real())
            if re != re or re in (float("inf"), float("-inf")):
                return named.get(str(x), "PositiveInfinity" if re > 0 else "NegativeInfinity" if re < 0 else "NaN")
            return repr(re)
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
    # Lists agree element by element: False if any pair is, True only if every pair is.
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        verdicts = []
        for i in range(len(a)):
            sub = []
            for trial in trials:
                try:
                    sub.append(None if trial is None else (trial[0][i], trial[1][i]))
                except (TypeError, IndexError):
                    sub.append(None)
            verdicts.append(enumeratio_symbolic_agree(a[i], b[i], sub))
        if any(v is False for v in verdicts):
            return False
        return True if all(v is True for v in verdicts) else None
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
        preamble: `from sympy import *\n${SYMPY_PREAMBLE}\n${PY_VALUE}\n${PY_BROADCAST}`,
        printer: "enumeratio_value",
      };
    case "mpmath":
      return {
        binary: "python3",
        preamble: `from mpmath import *\nmp.dps = 30\n${PY_VALUE}\n${PY_BROADCAST}`,
        printer: "enumeratio_value",
      };
    case "sage":
      return {
        binary: "sage",
        preamble: `from sage.misc.sage_eval import sage_eval\n${SAGE_PREAMBLE}\n${PY_BROADCAST}`,
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
  /** Seconds one item may run before it counts as an error (default `ITEM_SECONDS`). */
  readonly itemSeconds?: number;
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
    const batch = await runBatch(system, sources.slice(start, start + BATCH), options.itemSeconds ?? ITEM_SECONDS);
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

function runBatch(system: System, sources: readonly string[], itemSeconds: number): Promise<Result[]> {
  switch (system) {
    case "wolfram":
      return runWolfram(sources, itemSeconds);
    case "sympy":
      return runPython(
        sources,
        "python3",
        `from sympy import *\n${SYMPY_PREAMBLE}\n${PY_VALUE}\n${PY_BROADCAST}`,
        ["-c"],
        undefined,
        "enumeratio_value",
        itemSeconds,
      );
    case "mpmath":
      return runPython(
        sources,
        "python3",
        `from mpmath import *\nmp.dps = 30\n${PY_VALUE}\n${PY_BROADCAST}`,
        ["-c"],
        undefined,
        "enumeratio_value",
        itemSeconds,
      );
    case "sage":
      // `sage -c` takes one program string, like python3 -c. `locals=<per-item ns>` is what
      // lets `sage_eval` see SAGE_PREAMBLE's helpers (copied into that namespace from the
      // module globals snapshotted right after the preamble runs) without also seeing the
      // batch loop's own bookkeeping names.
      return runPython(
        sources,
        "sage",
        `from sage.misc.sage_eval import sage_eval\n${SAGE_PREAMBLE}\n${PY_BROADCAST}`,
        ["-c"],
        (src, ns) => `sage_eval(${src}, locals=${ns})`,
        "enumeratio_value",
        itemSeconds,
      );
    case "oscar":
      return runJulia(sources, "oscar", "Oscar", join(local("oscar"), "preamble.jl"), itemSeconds);
    case "julia":
      return runJulia(sources, "julia", "Nemo, Combinatorics", undefined, itemSeconds);
    case "mathlib4":
      return runLean(sources);
    case "rust":
      return runRust(sources);
    default:
      throw new Error("unreachable: System is exhaustive above");
  }
}
