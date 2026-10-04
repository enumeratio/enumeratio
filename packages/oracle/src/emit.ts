// MathJSON → source for one external system, or a reason it cannot be done.
//
// Failing loudly and specifically is the whole point. "Could not emit" is useless; "no
// mapping for `RademacherSymbol` at arity 1" tells you which row to add next, and a scan
// that counts those is a work queue rather than a verdict.

import { CONTEXT, HEADS, isSystemName, isWolframHead, SYMBOLS, toWolfram } from "@enumeratio/wolfram";
import { CARRIER_NAMES, CARRIER_PARAMS } from "./carrier-names-data.ts";
import { DEFINED_NAMES } from "./defined-names-data.ts";
import { mappingFor, THREADS_MANUALLY } from "./mappings.ts";
import type { System } from "./systems.ts";

export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

export type Emitted =
  | { readonly ok: true; readonly source: string; readonly freeSymbols?: readonly string[] }
  | { readonly ok: false; readonly missing: readonly string[] };

const isCall = (value: MathJSON): value is readonly MathJSON[] => Array.isArray(value) && typeof value[0] === "string";

/** compute-engine symbol constants, per system. */
const CONSTANTS: Record<string, Partial<Record<System, string>>> = {
  Pi: { wolfram: "Pi", sympy: "pi", mpmath: "pi", sage: "pi", rust: "x(std::f64::consts::PI)" },
  ExponentialE: {
    wolfram: "E",
    sympy: "E",
    mpmath: "e",
    sage: "e",
    rust: "x(std::f64::consts::E)",
  },
  ImaginaryUnit: { wolfram: "I", sympy: "I", mpmath: "mpc(0,1)", sage: "I" },
  EulerGamma: { wolfram: "EulerGamma", sympy: "EulerGamma", mpmath: "euler", sage: "euler_gamma" },
  GoldenRatio: {
    wolfram: "GoldenRatio",
    sympy: "GoldenRatio",
    mpmath: "phi",
    sage: "golden_ratio",
  },
  True: { wolfram: "True", sympy: "True", mpmath: "True", sage: "True", rust: "V::Bool(true)" },
  False: {
    wolfram: "False",
    sympy: "False",
    mpmath: "False",
    sage: "False",
    rust: "V::Bool(false)",
  },
  // Named values, not free variables — a bare `NaN` or `ComplexInfinity` used to fall through
  // to the same "unknown bare symbol" path a real free variable does, which the symbolic-
  // system fix below (#A-72) would otherwise turn into a bogus `Symbol("NaN")`: a variable
  // named NaN, not the not-a-number value. sympy has no exact Glaisher/Khinchin, so those two
  // stay unmapped there rather than guessed at.
  NaN: { wolfram: "Indeterminate", sympy: "nan", mpmath: "nan", sage: "NaN" },
  // Our other named "no value" answer, for an exact indeterminate form (0/0) rather than a
  // floating-point result — Wolfram (and every other system here) has only the one notion,
  // so it emits identically to NaN above.
  Indeterminate: { wolfram: "Indeterminate", sympy: "nan", mpmath: "nan", sage: "NaN" },
  ComplexInfinity: { wolfram: "ComplexInfinity", sympy: "zoo", sage: "unsigned_infinity" },
  PositiveInfinity: { wolfram: "Infinity", sympy: "oo", mpmath: "inf", sage: "oo" },
  NegativeInfinity: { wolfram: "-Infinity", sympy: "-oo", mpmath: "-inf", sage: "-oo" },
  ConstGlaisher: { wolfram: "Glaisher", mpmath: "glaisher", sage: "glaisher" },
  Khinchin: { wolfram: "Khinchin", mpmath: "khinchin", sage: "khinchin" },
  // Our carrier's plural type-space symbol, now DEFINED_NAMES-defined (declareCarriers'
  // default plural folding). Without an entry here it would fall into the DEFINED_NAMES
  // branch below and get reported missing whenever it appears as a bare option VALUE
  // (`Over -> GaussianIntegers`) — a named value here too, same as True/False/NaN above,
  // not a free variable. Wolfram's own name for the same choice is unprefixed
  // `GaussianIntegers` (see @enumeratio/wolfram's `FOREIGN` and `to-wolfram.ts`'s
  // `KeyValuePair` special case); no other system's emit ever reaches this bare, since none
  // has a curated `Over`-arity mapping for the heads that take it.
  GaussianIntegers: { wolfram: "GaussianIntegers" },
  // Same shape as `GaussianIntegers` above — a domain, `DEFINED_NAMES`-defined, whose bare
  // name Wolfram already spells identically (`Element[m, Integers]`). Without this it fell
  // into the DEFINED_NAMES branch and reported `symbol:Integers` missing on every `Assuming`/
  // `Refine` example that names it, even though the fallthrough text was already right.
  Integers: { wolfram: "Integers" },
};

/**
 * Fill a template. `$1`…`$9` are positional; `$*sep` joins every operand with `sep`, which
 * is what variadic heads like `Add` need in the Python-family systems where there is no
 * n-ary function to call.
 */
function fill(template: string, parts: readonly string[]): string {
  const variadic = /\$\*(.)/.exec(template);
  if (variadic !== null) {
    const separator = variadic[1] as string;
    const joined = parts.join(separator === "," ? ", " : ` ${separator} `);
    return template.replace(/\$\*./, joined);
  }
  return template.replace(/\$(\d)/g, (_match, index: string) => parts[Number(index) - 1] ?? "");
}

/** Heads whose operands thread over lists, which Python's own operators do not. */
const BROADCAST_HEADS = new Set(["Add", "Subtract", "Multiply", "Divide", "Power"]);
const PYTHON_FAMILY: readonly System[] = ["sympy", "mpmath", "sage"];

/** Emit `expr` as source for `system`, collecting every head it has no mapping for. */
/** A free name for Wolfram: one that's also a `System`` name (`E`, `I`, `K`, `O`) would
 * be Wolfram's constant or function there, so it goes in our own context, which `fromWolfram`
 * strips on the way back. */
const wolframFree = (name: string): string => (isSystemName(name) ? `${CONTEXT}${name}` : toWolfram(name));

export function emit(expr: MathJSON, system: System): Emitted {
  const missing: string[] = [];
  // Variables an enclosing Sum/Product iterator binds — not free, so not missing.
  const bound = new Set<string>();
  // Every free bare symbol actually seen, regardless of system — the numeric-only lanes still
  // report it as missing, but the caller (a symbolic-agreement check) needs the names either way.
  const free = new Set<string>();

  const walk = (node: MathJSON): string => {
    // Wolfram's exponent marker is `*^`, and `1e-11` there is `1 * e - 11`.
    if (typeof node === "number") {
      if (system === "wolfram") return toWolfram(node);
      // Lean reads `f -1` as `f - 1`.
      // Rust values are the prelude's dynamic `V` (rust/src/prelude.rs).
      if (system === "rust") return Number.isSafeInteger(node) ? `n(${node})` : `x(${node})`;
      return system === "mathlib4" && node < 0 ? `(${node})` : String(node);
    }
    if (typeof node === "boolean") return node ? "True" : "False";
    if (typeof node === "string") {
      // A MathJSON string literal is single-quoted; anything else is a symbol.
      if (/^'.*'$/s.test(node)) return JSON.stringify(node.slice(1, -1));
      const constant = CONSTANTS[node]?.[system];
      if (constant !== undefined) return constant;
      // Wolfram also knows the rest of the constants, the slots a Function binds, and a
      // mapped head passed as a value (`Fold(Add, 0, xs)`).
      if (system === "wolfram" && (node in SYMBOLS || node in HEADS || /^_\d+$/.test(node))) return toWolfram(node);
      if (!bound.has(node)) {
        // A symbol is unknown (a free variable) exactly when compute-engine has no
        // definition for it — DEFINED_NAMES (defined-names-data.ts) is generated from the
        // fully-declared reference engine's own `lookupDefinition`, over every symbol this
        // codebase's reference data actually uses. `Primes` and `NaN` are defined (a domain,
        // a constant — `Element(x, Primes)`'s `Primes` is not a value to guess at, and
        // letting the symbolic-agreement fallback (symbolic.ts) substitute a random rational
        // FOR a set would be nonsense); `x` and DSolveValue's `Y` are not, so they're free.
        // `_a` (our prefix-underscore named-wildcard convention, `Replace`'s patterns) is
        // undefined too, but still not a free variable — Wolfram's own pattern syntax is a
        // SUFFIX underscore (`a_`), so `_a` bare would parse there as `Blank[a]`, a different
        // pattern altogether; staying missing is honest, passing it through wouldn't be.
        if (DEFINED_NAMES.has(node) || node in CONSTANTS || /^_[A-Za-z]/.test(node)) {
          missing.push(`symbol:${node}`);
          return node;
        }
        // A genuinely unknown lowercase bare symbol is a free variable. A symbolic system can
        // carry it through — Wolfram verbatim (toWolfram passes an unmapped name through
        // unchanged), SymPy and Sage as an explicit symbolic value, since neither
        // auto-declares a bare name the way Wolfram does. A numeric-only lane has nothing to
        // do with a name, so it stays missing.
        free.add(node);
        if (system === "wolfram") return wolframFree(node);
        if (system === "sympy") return `Symbol(${JSON.stringify(node)})`;
        if (system === "sage") return `SR.var(${JSON.stringify(node)})`;
        missing.push(`symbol:${node}`);
      }
      return node;
    }
    if (!isCall(node)) {
      const value = (node as { num?: unknown }).num;
      if (typeof value === "string") {
        if (system === "wolfram") return toWolfram({ num: value });
        if (system === "rust") return /^-?\d+$/.test(value) ? `big("${value}")` : `x(${value})`;
        // A Python float literal holds 53 bits; SymPy keeps every digit of a longer decimal.
        if (system === "sympy" && /[.e]/i.test(value) && value.replace(/e.*$/i, "").replace(/\D/g, "").length > 15)
          return `Float(${JSON.stringify(value)}, 50)`;
        return value;
      }
      missing.push("literal:unrecognised");
      return "0";
    }
    const head = node[0] as string;
    const operands = node.slice(1);
    const iterated = (head === "Sum" || head === "Product") && operands.length > 1 ? operands.slice(1) : [];
    const binders = iterated.flatMap((it) =>
      isCall(it) && (it[0] === "Tuple" || it[0] === "List") && typeof it[1] === "string" ? [it[1]] : [],
    );
    const fresh = binders.filter((v) => !bound.has(v));
    for (const v of fresh) bound.add(v);
    try {
      return walkCall(head, operands);
    } finally {
      for (const v of fresh) bound.delete(v);
    }
  };

  /**
   * Rebuild `node`'s `List` nesting as list literals (Python's or Julia's — both spell one
   * `[a, b, c]`), applying `template` (with `others` filled into every position but
   * `threadArg`) at each leaf — the manual Listable thread `threadArg` asks for on a system
   * whose call is not itself broadcasting.
   */
  const threadOver = (node: MathJSON, template: string, others: readonly string[], threadArg: number): string => {
    if (isCall(node) && node[0] === "List") {
      return `[${node
        .slice(1)
        .map((el) => threadOver(el, template, others, threadArg))
        .join(", ")}]`;
    }
    const parts = [...others];
    parts.splice(threadArg - 1, 0, walk(node));
    return fill(template, parts);
  };

  const walkCall = (head: string, operands: readonly MathJSON[]): string => {
    // `["String", "s0"]` spells a string, not the symbol s0.
    if (head === "String" && operands.length === 1 && typeof operands[0] === "string")
      return JSON.stringify(operands[0]);
    // CycleDecomposition(Permutation(...)) / Permutation(CycleDecomposition(...)): the ONE
    // case where these two carriers (both `CARRIER_NAMES`) need more than the generic
    // unwrap-to-bare-contents fallback below -- one wrapping the other is a cycle-notation
    // <-> one-line-notation format CONVERSION (`toWolfram`'s own SPECIAL case:
    // `PermutationCycles`/`PermutationList∘Cycles`), not a value to unwrap past. Telling
    // "composed" from "bare" apart needs the RAW tree -- the generic per-operand `walk()`
    // the isWolframHead branch further down would use instead stringifies a nested carrier
    // call before the outer one ever saw its head, losing exactly that distinction. A BARE
    // `Permutation(list)`/`CycleDecomposition(list)` (not composed) falls through to the
    // unwrap below exactly as before.
    if (system === "wolfram" && (head === "CycleDecomposition" || head === "Permutation") && operands.length === 1) {
      const inner = operands[0];
      const complement = head === "CycleDecomposition" ? "Permutation" : "CycleDecomposition";
      if (isCall(inner) && inner[0] === complement && inner.length === 2) {
        return toWolfram([head, ...operands] as Parameters<typeof toWolfram>[0]);
      }
    }
    // Thread(Equal(...)): the SAME raw-tree problem, from a different generic mechanism --
    // `Equal` has its own per-system MAPPINGS_DATA template (`"($1 == $2)"`, infix, for the
    // symbolic systems' own comparison operator), which the generic dispatch below applies
    // to the inner operand BEFORE `toWolfram`'s `Thread` SPECIAL case ever runs, turning it
    // into a parenthesized infix STRING no longer shaped like `Equal[...]` -- exactly the
    // shape that case's own `headArgs` needs to recognize to know Thread needs Unevaluated.
    // Bypassing straight to `toWolfram` on the untouched node, as CycleDecomposition/
    // Permutation above, sidesteps the mapping template the same way it sidesteps the
    // carrier unwrap.
    if (system === "wolfram" && head === "Thread" && operands.length === 1) {
      const inner = operands[0];
      if (isCall(inner) && inner[0] === "Equal" && inner.length === 3) {
        return toWolfram([head, ...operands] as Parameters<typeof toWolfram>[0]);
      }
    }
    // Sign(Permutation(...)): the SAME raw-tree problem (A-126 head survey, #495) -- `Sign`
    // is overloaded over `complex | permutation`, and `toWolfram`'s own `Sign` SPECIAL case
    // needs the RAW `Permutation(...)` tree to tell "this is the permutation-parity
    // statistic, emit Signature[...]" from "this is the numeric Sign[...]" apart. The
    // generic per-operand `walk()` below would unwrap `Permutation(...)` to its bare list
    // contents first (the CARRIER_NAMES fallback further down, same mechanism the
    // CycleDecomposition/Permutation case above dodges), losing that distinction before
    // `Sign`'s own dispatch ever runs.
    if (system === "wolfram" && head === "Sign" && operands.length === 1) {
      const inner = operands[0];
      if (isCall(inner) && inner[0] === "Permutation") {
        return toWolfram([head, ...operands] as Parameters<typeof toWolfram>[0]);
      }
    }
    const mapping = mappingFor(head, operands.length);
    const template = mapping?.emit[system];
    if (template !== undefined) {
      const threadArg = mapping?.threadArg;
      const threaded = threadArg !== undefined ? operands[threadArg - 1] : undefined;
      if (
        threadArg !== undefined &&
        threaded !== undefined &&
        THREADS_MANUALLY.includes(system) &&
        isCall(threaded) &&
        threaded[0] === "List"
      ) {
        const others = operands.filter((_op, i) => i !== threadArg - 1).map((op) => walk(op));
        return threadOver(threaded, template, others, threadArg);
      }
      // Arithmetic over a list: Python's `+` concatenates and `*` repeats, where compute-engine
      // and Wolfram work element by element.
      if (
        BROADCAST_HEADS.has(head) &&
        PYTHON_FAMILY.includes(system) &&
        operands.some((op) => isCall(op) && op[0] === "List")
      ) {
        const params = operands.map((_op, i) => `_a${i}`);
        return `enumeratio_broadcast(lambda ${params.join(", ")}: ${fill(template, params)}, ${operands.map(walk).join(", ")})`;
      }
      return fill(template, operands.map(walk));
    }
    // A carrier CONSTRUCTOR call (`Permutation([2, 1, 3])`) with no mapping of its own: we
    // decide what counts as equivalent, and an external system's raw structure IS our
    // carrier value — https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
    // §4 step 5. Unwrap to the contents every carrier constructor is declared over exactly
    // one of (`declareConstructor`'s `(shape) -> type` signature; `contentsOf` reads the same
    // single operand) so the emitted source is the system's own plain list/tuple, not a
    // missing head. A future per-system mapping (added to mappings-data.ts) still wins, since
    // `mappingFor` above is tried first.
    //
    // A family with `carrierParams` (e.g. `Tournament(n, edges)`) packs its leading params and
    // its element into that one operand as a `Tuple` — `n` has no counterpart in the systems
    // we oracle against (there's no bare `Tuple/2` mapping, and never will be: a fixed arity
    // depends on which family built it), so unwrap ONE level further, past the carrier's own
    // declared `carrierParams` count (`CARRIER_PARAMS`, TQ-5), to what's left -- the element
    // itself (`edges`), which every system already has a plain list/tuple encoding for.
    //
    // A COMPOSITE carrier (`carrierElements`, e.g. `StandardTableauPair`) packs the same
    // shape -- a multi-arg Tuple -- but declares no `carrierParams` (0 leading slots to drop),
    // and more than one slot is left over: `P` and `Q`, both sub-carrier calls. Discarding all
    // but the last there would silently drop `P`. Since 0 leading params leaves every slot
    // in place, this falls out of the same rule rather than a separate "every slot is a
    // carrier call" heuristic: what's left after dropping the declared count of leading
    // params is either one element (unwrap to it) or several (the whole tuple carries
    // meaning, missing for a system with no bare-Tuple mapping, rather than a wrong answer).
    // `ContinuedFraction(x)` of a number is the expansion, a function; only a list of terms
    // is the carrier.
    const expands =
      head === "ContinuedFraction" &&
      !(isCall(operands[0] as MathJSON) && (operands[0] as readonly MathJSON[])[0] === "List");
    if (CARRIER_NAMES.has(head) && operands.length === 1 && !expands) {
      const contents = operands[0] as MathJSON;
      const packed = isCall(contents) && contents[0] === "Tuple" && contents.length > 2 ? contents : undefined;
      if (packed === undefined) return walk(contents);
      const packedOperands = packed.slice(1);
      const rest = packedOperands.slice(CARRIER_PARAMS.get(head) ?? 0);
      return rest.length === 1 ? walk(rest[0] as MathJSON) : walk(["Tuple", ...rest] as MathJSON);
    }
    // Module(vars, body)/With(vars, body): a local's initial value is `Equal(n, 10)`
    // (compute-engine's own equality head, `n == 10`), but Wolfram's Module/With need an
    // ASSIGNMENT there (`Set[n, 10]`) — left as `Equal`, the vars list isn't a valid
    // local-variable spec and the whole call stays unevaluated (found scanning #A-72 phase
    // 2's newly-emitting rows: `Module[List[Equal[n,10]], ...]` never ran). `toWolfram`'s own
    // `Module`/`With` SPECIAL cases do this rewrite already, but only see it when GIVEN the
    // raw tree — the generic fallback below hands it pre-walked (already-stringified)
    // operands, which is opaque to that rewrite, so this rewrite has to happen before
    // walking, on the raw operand tree, leaf-by-leaf through `walk` (for `missing` tracking).
    if (system === "wolfram" && (head === "Module" || head === "With") && operands.length === 2) {
      const [vars, body] = operands;
      const rewriteBinding = (v: MathJSON): string =>
        isCall(v) && v[0] === "Equal" && v.length === 3 ? `Set[${walk(v[1])}, ${walk(v[2])}]` : walk(v);
      const varsSource =
        isCall(vars) && vars[0] === "List"
          ? `List[${vars.slice(1).map(rewriteBinding).join(", ")}]`
          : rewriteBinding(vars);
      return `${head}[${varsSource}, ${walk(body)}]`;
    }
    // compute-engine's canonical Function wraps its body in a scoping Block, which Wolfram's
    // has no counterpart for: `Function(Block(f(_1)), _1)` is `Function[f[#]]`.
    if (system === "wolfram" && head === "Function" && isCall(operands[0]) && operands[0][0] === "Block") {
      return walk([head, ...operands[0].slice(1), ...operands.slice(1)] as MathJSON);
    }
    // An integrand, summand or factor is canonically a Function of the iteration variable;
    // Wolfram takes the body itself, over its iterator.
    if (system === "wolfram" && ["Integrate", "Sum", "Product"].includes(head) && isCall(operands[0])) {
      const [f, ...rest] = operands;
      if (f[0] === "Function") {
        const body = isCall(f[1]) && f[1][0] === "Block" ? f[1][1] : f[1];
        return walk([head, body, ...rest] as MathJSON);
      }
    }
    // An iterator: `Limits(x, a, b)` is `{x, a, b}`; `Limits(x, Nothing, b)`, a sum from 1,
    // is `{x, b}`; `Limits(x, Nothing, Nothing)`, an indefinite integral's, is `x` alone.
    if (system === "wolfram" && head === "Limits" && operands.length === 3) {
      const [x, a, b] = operands;
      if (a === "Nothing" && b === "Nothing") return walk(x!);
      return `List[${(a === "Nothing" ? [x!, b!] : [x!, a!, b!]).map(walk).join(", ")}]`;
    }
    // Wolfram has a whole transpiler behind it; a signature row here only overrides it.
    // The operands are already Wolfram source, and `toWolfram` passes an unknown bare
    // symbol through verbatim, so handing them back as symbols yields the head's shape.
    if (system === "wolfram" && isWolframHead(head)) return toWolfram([head, ...operands.map(walk)]);
    // An undefined head used AS a function — `Y(x)` for DSolveValue's unknown solution `Y` —
    // is the same "free variable" case as a bare undefined symbol, just called instead of
    // referenced. Wolfram reads `Y[x]` with an undefined `Y` exactly as compute-engine means
    // it: an unevaluated symbolic function application, not an error. A pattern-variable-
    // shaped name (`_a`) is excluded for the same reason a bare one is (emit.ts's string
    // branch, above) — this codebase's own convention, not a math name.
    if (system === "wolfram" && !DEFINED_NAMES.has(head) && !(head in CONSTANTS) && !/^_[A-Za-z]/.test(head)) {
      free.add(head);
      return `${wolframFree(head)}[${operands.map(walk).join(", ")}]`;
    }
    missing.push(`${head}/${operands.length}`);
    return "0";
  };

  const source = walk(expr);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, source, ...(free.size > 0 ? { freeSymbols: [...free].toSorted() } : {}) };
}

/** Which heads in an expression have no mapping for a system — the work queue. */
export function unmappedHeads(expr: MathJSON, system: System): string[] {
  const result = emit(expr, system);
  return result.ok ? [] : [...new Set(result.missing)];
}
