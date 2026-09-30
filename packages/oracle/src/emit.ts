// MathJSON → source for one external system, or a reason it cannot be done.
//
// Failing loudly and specifically is the whole point. "Could not emit" is useless; "no
// mapping for `RademacherSymbol` at arity 1" tells you which row to add next, and a scan
// that counts those is a work queue rather than a verdict.

import { HEADS, isWolframHead, SYMBOLS, toWolfram } from "@enumeratio/wolfram/src";
import { CARRIER_NAMES } from "./carrier-names-data.ts";
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

/** Emit `expr` as source for `system`, collecting every head it has no mapping for. */
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
        if (system === "wolfram") return toWolfram(node);
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
    // depends on which family built it), so unwrap ONE level further, to the Tuple's LAST
    // element -- the element itself (`edges`), which every system already has a plain
    // list/tuple encoding for. A single-param carrier's operand is never itself a multi-arg
    // Tuple built this way, so this never fires for one.
    //
    // A COMPOSITE carrier (`carrierElements`, e.g. `StandardTableauPair`) packs the same
    // shape -- a multi-arg Tuple -- but every slot is itself a sub-carrier constructor call,
    // not a leading param then the element. Discarding all but the last slot there would
    // silently drop `P` and compare only `Q`. Distinguish by that: if every slot is a
    // carrier call, the whole tuple carries meaning and walks like any other Tuple (missing,
    // for a system with no bare-Tuple mapping, rather than a wrong answer).
    if (CARRIER_NAMES.has(head) && operands.length === 1) {
      const contents = operands[0] as MathJSON;
      const packed = isCall(contents) && contents[0] === "Tuple" && contents.length > 2 ? contents : undefined;
      if (packed === undefined) return walk(contents);
      const packedOperands = packed.slice(1);
      if (packedOperands.every((op) => isCall(op) && CARRIER_NAMES.has(op[0] as string))) return walk(packed);
      return walk(packedOperands[packedOperands.length - 1] as MathJSON);
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
      return toWolfram([head, ...operands.map(walk)]);
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
