// Native harness generator for Nemo+Combinatorics ("julia") and Oscar ("oscar"): one Julia
// script per system, self-contained, implementing the contract in generate.ts. The two systems
// share everything but the `using` line, the project, and (for Oscar) the preamble include —
// all three come from `preludeFor`, so this stays in lockstep with the oracle scan.

import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { juliaFlags, preludeFor } from "@enumeratio/oracle/src";
import type { Generator } from "../generate.ts";
import { planned } from "../generate.ts";
import { PROTOCOL, QUIT } from "../protocol.ts";
import type { HarnessCommand } from "../run.ts";
import type { Plan } from "../types.ts";

type JuliaSystem = "julia" | "oscar";

export const CACHES_JULIA: "cleared" | "uncleared" = "uncleared";
export const CACHES_OSCAR: "cleared" | "uncleared" = "uncleared";

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));
const generatedDir = (system: JuliaSystem): string => here(`../../generated/${system}/`);

// `preludeFor`'s Oscar preamble `include`s preamble.jl by its absolute path on this checkout,
// which isn't safe to bake into a committed file (a different clone, or even this worktree,
// puts the repo somewhere else). Repointing it at a path relative to the generated harness's
// own directory keeps the file identical everywhere the repo is checked out.
function portablePreamble(system: JuliaSystem): string {
  const { preamble } = preludeFor(system);
  return preamble.replace(/include\((".*")\)/, (_match, quoted: string) => {
    const absolute = JSON.parse(quoted) as string;
    const rel = relative(generatedDir(system), absolute).split(sep).join("/");
    return `include(joinpath(@__DIR__, ${JSON.stringify(rel)}))`;
  });
}

/** A numeric literal outside any string: digits, an optional fraction and exponent, not
 * touching a run that continues into an identifier (so `stirlings2`'s `2` is left alone). */
const LITERAL = /(?<![\p{L}\p{N}_.])\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\p{L}\p{N}_])/gu;

/**
 * Hoist every numeric literal in `source` into a top-level `const _rN = Ref(value)`, reading
 * it back as `_rN[]`, so Julia's constant folding can't turn a call on literal arguments into
 * a compile-time constant (design/benchmarking.md §4, the BenchmarkTools `$`-interpolation
 * idiom). Skips strings, since a source only ever quotes group-algebra labels. `next` numbers
 * the refs so every one in the file is unique; `undefined` means "left as is" (unbalanced
 * quotes — nothing here does that today, but a future mapping might).
 */
function hoistLiterals(
  source: string,
  next: () => number,
): { readonly body: string; readonly consts: readonly string[] } | undefined {
  const segments: { readonly text: string; readonly quoted: boolean }[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== '"') j += source[j] === "\\" ? 2 : 1;
      if (j >= source.length) return undefined;
      segments.push({ text: source.slice(i, j + 1), quoted: true });
      i = j + 1;
    } else {
      const j = source.indexOf('"', i);
      const end = j === -1 ? source.length : j;
      segments.push({ text: source.slice(i, end), quoted: false });
      i = end;
    }
  }
  const consts: string[] = [];
  const body = segments
    .map((s) =>
      s.quoted
        ? s.text
        : s.text.replace(LITERAL, (literal) => {
            const id = `_r${next()}`;
            consts.push(`const ${id} = Ref(${literal})`);
            return `${id}[]`;
          }),
    )
    .join("");
  return { body, consts };
}

const JULIA_HARNESS_PRELUDE = `
struct Timed
    k::Int
    samplesNs::Vector{Float64}
    timedOut::Bool
end

# The measurement protocol (design/benchmarking.md §5), embedded from PROTOCOL so this file
# never drifts from protocol.ts. GC.gc() before each call is the closest thing Nemo/Combinatorics
# have to a cache clear (they keep no memo tables of their own — see CACHES_JULIA/CACHES_OSCAR).
function _measure(call::Function, budgetMs::Float64)::Timed
    start = time_ns()
    spent() = (time_ns() - start) / 1e6
    function timeit(k::Int)::Float64
        GC.gc()
        t0 = time_ns()
        for _ in 1:k
            call()
        end
        return (time_ns() - t0) / k
    end
    k = 1
    single = max(timeit(1), 1.0)
    if single < _PROTO_BATCH_BELOW_MS * 1e6
        while single * k < _PROTO_MIN_SAMPLE_MS * 1e6 && spent() < budgetMs
            k *= 2
        end
    end
    for _ in 1:_PROTO_WARMUP
        (spent() < _PROTO_WARMUP_MS && spent() < budgetMs) || break
        timeit(k)
    end
    samplesNs = Float64[]
    while length(samplesNs) < _PROTO_SAMPLES
        if length(samplesNs) >= _PROTO_MIN_SAMPLES && spent() >= budgetMs
            break
        end
        push!(samplesNs, timeit(k))
        if spent() >= budgetMs * 4
            break
        end
    end
    return Timed(k, samplesNs, length(samplesNs) < _PROTO_MIN_SAMPLES)
end

_json_escape(s::AbstractString) =
    replace(replace(replace(replace(String(s), "\\\\" => "\\\\\\\\"), "\\"" => "\\\\\\""), "\\n" => "\\\\n"), "\\r" => "")

function _run(name::AbstractString)::String
    entry = get(CASES, name, nothing)
    body = if entry === nothing
        "{\\"error\\":\\"no case " * _json_escape(name) * "\\"}"
    else
        try
            results = [f() for f in entry.funcs]
            value = show_oracle(results[1])
            n = length(entry.funcs)
            next = Ref(0)
            call() = begin
                v = entry.funcs[(next[] % n) + 1]()
                next[] += 1
                v
            end
            timed = _measure(call, entry.budgetMs)
            samples = join(map(string, timed.samplesNs), ",")
            "{\\"value\\":\\"" * _json_escape(value) * "\\",\\"k\\":" * string(timed.k) *
                ",\\"samplesNs\\":[" * samples * "],\\"timedOut\\":" * string(timed.timedOut) * "}"
        catch e
            msg = replace(sprint(showerror, e), "\\n" => " ")
            text = string(nameof(typeof(e))) * ": " * msg
            "{\\"error\\":\\"" * _json_escape(first(text, 200)) * "\\"}"
        end
    end
    return "<<" * name * ">>" * body
end

for line in eachline(stdin)
    name = strip(line)
    name == "${QUIT}" && break
    println(stdout, _run(name))
    flush(stdout)
end
`;

function generate(plan: Plan, system: JuliaSystem): Readonly<Record<string, string>> {
  let nextRef = 0;
  const defs: string[] = [];
  const entries: string[] = [];
  for (const [n, { name, case: c, sources }] of planned(plan, system).entries()) {
    const funcNames: string[] = [];
    sources.forEach((source, j) => {
      const funcName = `b_${n}_${j}`;
      const hoisted = hoistLiterals(source, () => nextRef++);
      if (hoisted === undefined) {
        defs.push(`# literal-fold guard skipped (unbalanced quotes): ${source}`);
        defs.push(`${funcName}() = ${source}`);
      } else {
        defs.push(...hoisted.consts);
        defs.push(`${funcName}() = ${hoisted.body}`);
      }
      funcNames.push(funcName);
    });
    entries.push(
      `    ${JSON.stringify(name)} => (budgetMs = ${(c.budget * 1000).toFixed(1)}, funcs = Function[${funcNames.join(", ")}]),`,
    );
  }

  const text = `# Generated by @enumeratio/bench (packages/bench/src/generators/julia.ts) from the
# catalogue (design/benchmarking.md §4). Regenerating this file must be a no-op — see
# packages/bench/tests/generated.test.ts — so don't hand-edit it.

${portablePreamble(system)}

const _PROTO_WARMUP = ${PROTOCOL.warmup}
const _PROTO_WARMUP_MS = ${PROTOCOL.warmupMs.toFixed(1)}
const _PROTO_SAMPLES = ${PROTOCOL.samples}
const _PROTO_MIN_SAMPLES = ${PROTOCOL.minSamples}
const _PROTO_BATCH_BELOW_MS = ${PROTOCOL.batchBelowMs.toFixed(1)}
const _PROTO_MIN_SAMPLE_MS = ${PROTOCOL.minSampleMs.toFixed(1)}

${defs.join("\n")}

const CASES = Dict(
${entries.join("\n")}
)
${JULIA_HARNESS_PRELUDE}`;
  return { "harness.jl": text };
}

export const generateJulia: Generator = (plan) => generate(plan, "julia");
export const generateOscar: Generator = (plan) => generate(plan, "oscar");

function harnessFor(system: JuliaSystem): HarnessCommand {
  const prelude = preludeFor(system);
  // juliaFlags resolves its argument itself (the project *name*, under packages/oracle/) —
  // preludeFor(system).project is already that path resolved, so passing it back in would
  // resolve it twice.
  return {
    command: prelude.binary,
    args: [...juliaFlags(system), here(`../../generated/${system}/harness.jl`)],
  };
}

export const harnessJulia = (): HarnessCommand => harnessFor("julia");
export const harnessOscar = (): HarnessCommand => harnessFor("oscar");
