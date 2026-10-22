// MathJSON → source for one external system, or a reason it cannot be done.
//
// Failing loudly and specifically is the whole point. "Could not emit" is useless; "no
// mapping for `RademacherSymbol` at arity 1" tells you which row to add next, and a scan
// that counts those is a work queue rather than a verdict.

import {
  CONTEXT,
  HEADS,
  isSystemName,
  isWolframHead,
  isWolframOwnName,
  NUMBER_SETS,
  ringOption,
  SYMBOLS,
  toWolfram,
} from "@enumeratio/wolfram";
import { CARRIER_NAMES, CARRIER_PARAMS } from "./carrier-names-data.ts";
import { DEFINED_NAMES } from "./defined-names-data.ts";
import { type Mapping, mappingFor, THREADS_MANUALLY } from "./mappings.ts";
import { isReserved, SAGE_UNBINDABLE, spareName } from "./reserved.ts";
import { SAGE_STATS } from "./sage-stats.ts";
import { isWolframFamily, type System } from "./systems.ts";

export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

export type Emitted =
  | {
      readonly ok: true;
      readonly source: string;
      readonly freeSymbols?: readonly string[];
      /** Names written under another name, because the system holds theirs (or refuses them): name → spelling. */
      readonly renamed?: Readonly<Record<string, string>>;
    }
  | { readonly ok: false; readonly missing: readonly string[] };

const isCall = (value: MathJSON): value is readonly MathJSON[] => Array.isArray(value) && typeof value[0] === "string";

/** compute-engine symbol constants, per system. */
const CONSTANTS: Record<string, Partial<Record<System, string>>> = {
  Pi: { wolfram: "Pi", sympy: "pi", mpmath: "pi", sage: "pi", julia: "const_pi(RR)", rust: "x(std::f64::consts::PI)" },
  ExponentialE: {
    wolfram: "E",
    sympy: "E",
    mpmath: "e",
    sage: "e",
    julia: "const_e(RR)",
    rust: "x(std::f64::consts::E)",
  },
  ImaginaryUnit: { wolfram: "I", sympy: "I", mpmath: "mpc(0,1)", sage: "I", julia: "onei(CC)" },
  EulerGamma: {
    wolfram: "EulerGamma",
    sympy: "EulerGamma",
    mpmath: "euler",
    sage: "euler_gamma",
    julia: "const_euler(RR)",
  },
  GoldenRatio: {
    wolfram: "GoldenRatio",
    sympy: "GoldenRatio",
    mpmath: "phi",
    sage: "golden_ratio",
    julia: "((1 + sqrt(RR(5))) / 2)",
  },
  True: { wolfram: "True", sympy: "True", mpmath: "True", sage: "True", julia: "true", rust: "V::Bool(true)" },
  False: {
    wolfram: "False",
    sympy: "False",
    mpmath: "False",
    sage: "False",
    julia: "false",
    rust: "V::Bool(false)",
  },
  // Named values, not free variables — a bare `NaN` or `ComplexInfinity` used to fall through
  // to the same "unknown bare symbol" path a real free variable does, which the symbolic-
  // system fix below (#A-72) would otherwise turn into a bogus `Symbol("NaN")`: a variable
  // named NaN, not the not-a-number value. sympy has no exact Glaisher/Khinchin, so those two
  // stay unmapped there rather than guessed at.
  NaN: { wolfram: "Indeterminate", sympy: "nan", mpmath: "nan", sage: "NaN", julia: "NaN" },
  // Our other named "no value" answer, for an exact indeterminate form (0/0) rather than a
  // floating-point result — Wolfram (and every other system here) has only the one notion,
  // so it emits identically to NaN above.
  Indeterminate: { wolfram: "Indeterminate", sympy: "nan", mpmath: "nan", sage: "NaN", julia: "NaN" },
  ComplexInfinity: { wolfram: "ComplexInfinity", sympy: "zoo", sage: "unsigned_infinity" },
  PositiveInfinity: { wolfram: "Infinity", sympy: "oo", mpmath: "inf", sage: "oo", julia: "Inf" },
  NegativeInfinity: { wolfram: "-Infinity", sympy: "-oo", mpmath: "-inf", sage: "-oo", julia: "(-Inf)" },
  ConstGlaisher: { wolfram: "Glaisher", mpmath: "glaisher", sage: "glaisher", julia: "const_glaisher(RR)" },
  MachinePrecision: { wolfram: "MachinePrecision" },
  Khinchin: { wolfram: "Khinchin", mpmath: "khinchin", sage: "khinchin", julia: "const_khinchin(RR)" },
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

/** Functions with no derivative in a complex variable: Sage would differentiate them as on the line. */
const NON_HOLOMORPHIC = new Set([
  "Abs",
  "Sign",
  "Conjugate",
  "Real",
  "Imaginary",
  "Argument",
  "Floor",
  "Ceil",
  "Round",
]);

/** Graph constructors whose vertex numbering is not Sage's sorted order, and the queries that read a numbering. */
const UNSORTED_GRAPHS = new Set(["TuranGraph", "HararyGraph", "GridGraph"]);
const NUMBERED_QUERIES = new Set([
  "VertexDegree",
  "VertexEccentricity",
  "GraphDistance",
  "FindShortestPath",
  "GraphCenter",
  "VertexList",
  "AdjacencyMatrix",
  "ConnectedComponents",
  "EdgeList",
]);
const mentions = (node: MathJSON, heads: ReadonlySet<string>): boolean =>
  isCall(node) && (heads.has(node[0] as string) || node.slice(1).some((child) => mentions(child as MathJSON, heads)));

/** Heads whose operands thread over lists, which Python's own operators do not. */
const BROADCAST_HEADS = new Set(["Add", "Subtract", "Multiply", "Divide", "Power"]);
/** Bits for a decimal read inside N(…): the 200 at which Sage matches ours to 20 digits near a pole. */
const SAGE_DECIMAL_BITS = 200;

/** Whether a decimal's text is a double exactly (0.25, not 0.1): its fraction is k/2^m. */
const isDyadic = (text: string): boolean => {
  const [, digits = "", fraction = ""] = /^-?(\d*)\.?(\d*)$/.exec(text) ?? [];
  return text.match(/e/i) === null && BigInt(digits + fraction || "0") % 5n ** BigInt(fraction.length) === 0n;
};

const PYTHON_FAMILY: readonly System[] = ["sympy", "mpmath", "sage"];

/** Emit `expr` as source for `system`, collecting every head it has no mapping for. */
/** A free name for Wolfram: one that's also a `System`` name (`E`, `I`, `K`, `O`) would
 * be Wolfram's constant or function there, so it goes in our own context, which `fromWolfram`
 * strips on the way back. */
const wolframFree = (name: string): string => (isSystemName(name) ? `${CONTEXT}${name}` : toWolfram(name));

/** Wolfram's spellings of our number sets (`Reals`): a set a call names, never a variable. */
const NUMBER_SET_NAMES: ReadonlySet<string> = new Set(Object.values(NUMBER_SETS));

/** A residue class (`IntegerMod`), or arithmetic over one. */
const isResidue = (node: MathJSON): boolean =>
  isCall(node) &&
  (node[0] === "IntegerMod" ||
    (["Add", "Subtract", "Multiply", "Negate", "Divide", "Power"].includes(node[0] as string) &&
      node.slice(1).some((operand) => isResidue(operand as MathJSON))));

/** Every name `node` writes, quoted strings aside. */
const namesIn = (node: MathJSON, into = new Set<string>()): Set<string> => {
  if (typeof node === "string") {
    if (!/^'.*'$/s.test(node)) into.add(node);
  } else if (Array.isArray(node)) for (const child of node) namesIn(child as MathJSON, into);
  return into;
};

/** Whether a symbol (a free or bound variable) appears anywhere in `node`. */
const hasSymbol = (node: MathJSON): boolean =>
  typeof node === "string" || (isCall(node) && node.slice(1).some((operand) => hasSymbol(operand)));

/** SymPy's `PowerMod(a, s/r, m)`: the least root `x` of `x^r = a^s` (mod m), or `None` where there is none. */
const POWER_MOD_ROOT = "min(nthroot_mod(pow(ZZ.convert($1), S($2).p, ZZ.convert($3)), S($2).q, $3, True) or [None])";

/** A symbol that can be a series variable: not one of the named constants. */
const isVariable = (node: MathJSON): node is string => typeof node === "string" && !(node in CONSTANTS);

/** `x^-n` as `n`: the order of a series at infinity. */
const magnitude = (exponent: MathJSON): MathJSON | undefined => {
  if (typeof exponent === "number") return exponent < 0 ? -exponent : undefined;
  if (isCall(exponent) && exponent[0] === "Rational" && typeof exponent[1] === "number" && exponent[1] < 0)
    return ["Rational", -exponent[1], exponent[2]!];
  return undefined;
};

/**
 * `BigO` in Wolfram, which writes the exponent outside `O` and takes a bare variable and its
 * center: BigO(x^n) is `O[x]^n`, BigO((x - a)^n) is `O[x, a]^n`, BigO(x^-n) is `O[x, Infinity]^n`.
 * `O[x^n]` and `O[x - a]` are rejected there (SeriesData::sdatv).
 */
function bigO(given: MathJSON, walk: (node: MathJSON) => string): string {
  // Canonical x^(1/2) and x^(1/n) are `Sqrt(x)` and `Root(x, n)`.
  const operand: MathJSON =
    isCall(given) && given[0] === "Sqrt" && given.length === 2
      ? ["Power", given[1]!, ["Rational", 1, 2]]
      : isCall(given) && given[0] === "Root" && given.length === 3
        ? ["Power", given[1]!, ["Rational", 1, given[2]!]]
        : given;
  const power = isCall(operand) && operand[0] === "Power" && operand.length === 3;
  const base = power ? operand[1]! : operand;
  const exponent = power ? operand[2]! : undefined;
  const inverse = typeof base === "string" && exponent !== undefined ? magnitude(exponent) : undefined;
  if (inverse !== undefined) return `Power[O[${walk(base)}, Infinity], ${walk(inverse)}]`;
  const variables = isCall(base) && base[0] === "Add" ? base.slice(1).filter(isVariable) : [];
  let order = `O[${walk(base)}]`;
  if (isCall(base) && variables.length === 1) {
    const rest = base.slice(1).filter((term) => term !== variables[0]);
    order = `O[${walk(variables[0]!)}, ${walk(["Negate", rest.length === 1 ? rest[0]! : ["Add", ...rest]])}]`;
  }
  return exponent === undefined ? order : `Power[${order}, ${walk(exponent)}]`;
}

/** A double as Rust's float literal: `1e21` and `0.5` parse, but a bare `100` would be an integer there. */
const rustFloat = (value: number): string => `x(${/^-?\d+$/.test(String(value)) ? `${value}.0` : value})`;

/** Whether `node` is a real number written out: a literal, a rational, or arithmetic over them and the named constants. */
function isRealNumber(node: MathJSON): boolean {
  if (typeof node === "number") return true;
  if (typeof node === "string") return ["Pi", "ExponentialE", "EulerGamma", "GoldenRatio"].includes(node);
  if (isCall(node))
    return (
      ["Rational", "Negate", "Add", "Subtract", "Multiply", "Divide"].includes(node[0] as string) &&
      node.slice(1).every((operand) => isRealNumber(operand))
    );
  return typeof (node as { num?: unknown }).num === "string";
}

/** The `Series(f, x, x0, n)` call under any `Normal`/`Simplify`/`FullSimplify` wrappers, if that is all `expr` is. */
export function seriesCall(expr: MathJSON): readonly MathJSON[] | undefined {
  if (!isCall(expr)) return undefined;
  if (expr[0] === "Series" && expr.length === 5) return expr;
  return ["Normal", "Simplify", "FullSimplify"].includes(expr[0] as string) && expr.length === 2
    ? seriesCall(expr[1] as MathJSON)
    : undefined;
}

/** `expr` as `system`'s source. `extra` maps a library's heads (`mappingsFromBindings`), which an
 *  expression calls by namespace: `MemberCall(ns, "Name", …)` is emitted as `ns.Name(…)`. */
export function emit(expr: MathJSON, system: System, extra: readonly Mapping[] = []): Emitted {
  const wl = isWolframFamily(system);
  const missing: string[] = [];
  // Variables an enclosing Sum/Product iterator binds — not free, so not missing.
  const bound = new Set<string>();
  // Every free bare symbol actually seen, regardless of system — the numeric-only lanes still
  // report it as missing, but the caller (a symbolic-agreement check) needs the names either way.
  const free = new Set<string>();
  // A name the system's namespace already holds, written under a spare one: a `Sum` index
  // `e` would capture the `e` that `ExponentialE` emits. Computed once, so every use agrees.
  const renamed = new Map<string, string>();
  let taken: ReadonlySet<string> | undefined;
  const spared = (name: string): string => {
    taken ??= namesIn(expr);
    let spare = renamed.get(name);
    if (spare === undefined) renamed.set(name, (spare = spareName(system, name, taken)));
    return spare;
  };
  // The variables of a held derivative (below), named apart for each one, and those taken at real points.
  let derivatives = 0;
  const realDummies = new Set<string>();
  const boundName = (name: string): string => {
    if (wl) return isSystemName(name) ? `${CONTEXT}${name}` : name;
    // The symbols a held derivative differentiates are Sage variables, not Python names.
    if (system === "sage" && /^_d\d+$/.test(name))
      return `SR.var(${JSON.stringify(name)}${realDummies.has(name) ? ', domain="real"' : ""})`;
    // A real variable lets Abs and sign differentiate as they do on the line; at a complex point (sqrt(t**2) at I)
    // it would be the wrong function to differentiate.
    if (system === "sympy") return `Symbol(${JSON.stringify(name)}${realDummies.has(name) ? ", real=True" : ""})`;
    return isReserved(system, name) ? spared(name) : name;
  };

  // Combinatorica is the Wolfram transpiler plus its own head map: an expression with no map row
  // in it would only run in core Wolfram, which the `wolfram` lane already does.
  let fromCombinatorica = false;

  // The expression itself, and what a list of answers holds: where mpmath's N(x, d) can round to d digits.
  const answers = new Set<MathJSON>([expr]);
  // Whether the walk is inside the operand of an mpmath N(x, d) answer with d past a double's digits.
  let exact = false;
  // The largest d past a double's digits of a nested mpmath N(x, d): the whole expression runs at that precision.
  let nestedDigits = 0;
  // Bits for the decimals inside a Sage N(x[, d]) operand: ours reads them as decimals, not as the nearest double.
  let decimalBits = 0;
  const walk = (node: MathJSON): string => {
    // Wolfram's exponent marker is `*^`, and `1e-11` there is `1 * e - 11`.
    if (typeof node === "number") {
      if (wl) return toWolfram(node);
      // Lean reads `f -1` as `f - 1`.
      // Rust values are the prelude's dynamic `V` (rust/src/prelude.rs).
      if (system === "rust") {
        if (Number.isSafeInteger(node)) return `n(${node})`;
        // Past 2^53 an integer-valued number is the integer it spells, not a float.
        return Number.isInteger(node) ? `big("${BigInt(node)}")` : rustFloat(node);
      }
      // Inside an N(x, d) answer past a double's digits `0.1` would be the double, not the decimal.
      if (system === "mpmath" && exact && !Number.isInteger(node)) return `mpf(${JSON.stringify(String(node))})`;
      if (system === "sage" && decimalBits > 0 && !Number.isInteger(node) && !isDyadic(String(node)))
        return `RealField(${decimalBits})(${JSON.stringify(String(node))})`;
      if (system === "julia" && (!Number.isInteger(node) || /e/i.test(String(node))))
        return `enumeratio_decimal(${JSON.stringify(String(node))})`;
      return system === "mathlib4" && node < 0 ? `(${node})` : String(node);
    }
    if (typeof node === "boolean") return node ? "True" : "False";
    if (typeof node === "string") {
      // A MathJSON string literal is single-quoted; anything else is a symbol.
      if (/^'.*'$/s.test(node)) return JSON.stringify(node.slice(1, -1));
      const constant = CONSTANTS[node]?.[system];
      if (constant !== undefined) return constant;
      // A bare `Infinity` is `oo` for SymPy and Sage; scoped here, since a CONSTANTS row would make it missing elsewhere.
      if ((system === "sympy" || system === "sage") && node === "Infinity") return "oo";
      // Wolfram also knows the rest of the constants, the slots a Function binds, and a
      // mapped head passed as a value (`Fold(Add, 0, xs)`).
      if (wl && (node in SYMBOLS || node in HEADS || /^_\d+$/.test(node))) return toWolfram(node);
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
        // Wolfram's own name for one of our number sets is that set there too.
        if (wl && NUMBER_SET_NAMES.has(node)) return node;
        // So is a name that means Wolfram's own (`Infinity`, `Orderless`, `FontWeight`): not a variable.
        if (wl && isWolframOwnName(node)) return toWolfram(node);
        // A genuinely unknown lowercase bare symbol is a free variable. A symbolic system can
        // carry it through — Wolfram verbatim (toWolfram passes an unmapped name through
        // unchanged), SymPy and Sage as an explicit symbolic value, since neither
        // auto-declares a bare name the way Wolfram does. A numeric-only lane has nothing to
        // do with a name, so it stays missing.
        // Combinatorica answers values, not identities: a free symbol is unmapped there.
        if (system === "combinatorica") {
          missing.push(`symbol:${node}`);
          return node;
        }
        free.add(node);
        if (wl) return wolframFree(node);
        if (system === "sympy") return `Symbol(${JSON.stringify(node)})`;
        // `SR.var` refuses a keyword; it is written under a spare name, as a bound one is.
        if (system === "sage") return `SR.var(${JSON.stringify(SAGE_UNBINDABLE.has(node) ? spared(node) : node)})`;
        missing.push(`symbol:${node}`);
        return node;
      }
      return boundName(node);
    }
    if (!isCall(node)) {
      const value = (node as { num?: unknown }).num;
      if (typeof value === "string") {
        if (wl) return toWolfram({ num: value });
        if (system === "rust") {
          if (/^-?\d+$/.test(value)) return `big("${value}")`;
          // A double holds a decimal to ~16 digits: one past its range would be infinity or zero, not the number.
          const read = Number(value);
          if (!Number.isFinite(read) || (read === 0 && /[1-9]/.test(value.replace(/e.*$/i, "")))) {
            missing.push("literal:outside-double-range");
            return "0";
          }
          return rustFloat(read);
        }
        // A Python float literal holds 53 bits; SymPy keeps every digit of a longer decimal.
        if (system === "sympy" && /[.e]/i.test(value) && value.replace(/e.*$/i, "").replace(/\D/g, "").length > 15)
          return `Float(${JSON.stringify(value)}, 50)`;
        // Past the double range Python reads `1.0e1000` as inf (or `1e-1000` as 0) before SymPy sees it.
        if (
          system === "sympy" &&
          /[.e]/i.test(value) &&
          /[1-9]/.test(value.replace(/e.*$/i, "")) &&
          !(Math.abs(Number(value)) > 0 && Number.isFinite(Number(value)))
        )
          return `Float(${JSON.stringify(value)})`;
        // A decimal is exact in Julia: a rational, which no double rounds or underflows, and which a retry at more bits refines.
        if (system === "julia" && /[.e]/i.test(value)) return `enumeratio_decimal(${JSON.stringify(value)})`;
        // mpmath reads a string at its own precision: a longer decimal, or one past the double range, would round or overflow as a float.
        if (
          system === "mpmath" &&
          /[.e]/i.test(value) &&
          (exact ||
            value.replace(/e.*$/i, "").replace(/\D/g, "").replace(/^0+/, "").length > 15 ||
            (/[1-9]/.test(value.replace(/e.*$/i, "")) &&
              !(Math.abs(Number(value)) > 0 && Number.isFinite(Number(value)))))
        )
          return `mpf(${JSON.stringify(value)})`;
        return value;
      }
      missing.push("literal:unrecognised");
      return "0";
    }
    const head = node[0] as string;
    const operands = node.slice(1);
    if (system === "julia" && head === "List" && answers.has(node))
      for (const entry of operands) answers.add(entry as MathJSON);
    // Below the answer, Julia's N(x, d) is the rounded number, not the digits written out.
    if (system === "julia" && head === "N" && operands.length === 2 && !answers.has(node))
      return `enumeratio_n(${walk(operands[0] as MathJSON)}, ${walk(operands[1] as MathJSON)})`;
    if ((system === "sympy" || system === "rust") && head === "List" && answers.has(node))
      for (const entry of operands) answers.add(entry as MathJSON);
    // Below the answer, N(x, d) is the number rounded to d significant digits, so a comparison around it sees them.
    const digits = head === "N" && operands.length === 2 && !answers.has(node) ? operands[1] : undefined;
    const nested = typeof digits === "number";
    if (nested && system === "sympy") return `N(${walk(operands[0] as MathJSON)}, ${digits})`;
    if (nested && system === "rust") return `nfd(${walk(operands[0] as MathJSON)}, ${digits})`;
    if (system === "mpmath") {
      if (head === "List" && answers.has(node)) for (const entry of operands) answers.add(entry as MathJSON);
      // N(x, d) answers in text (run.ts), which can't be an operand: below the answer it is a number rounded to d digits.
      if (nested) {
        const wasExactNested = exact;
        if (digits > 15) {
          exact = true;
          nestedDigits = Math.max(nestedDigits, digits);
        }
        try {
          return `enumeratio_nround(lambda: (${walk(operands[0] as MathJSON)}), ${digits})`;
        } finally {
          exact = wasExactNested;
        }
      }
      if (head === "N" && operands.length === 2 && !answers.has(node)) return walk(operands[0] as MathJSON);
    }
    const iterated = (head === "Sum" || head === "Product") && operands.length > 1 ? operands.slice(1) : [];
    // A `Limits` iterator binds only for SymPy's Sum (below); the Wolfram lane keeps its free `k`.
    const binders = iterated.flatMap((it) =>
      // Sage's own sum keeps the index a symbol (below); a library's row for it binds the name.
      (system !== "sage" || extra.some((m) => m.head === head)) &&
      isCall(it) &&
      (it[0] === "Tuple" || it[0] === "List" || (system === "sympy" && it[0] === "Limits")) &&
      typeof it[1] === "string"
        ? [it[1]]
        : [],
    );
    const fresh = binders.filter((v) => !bound.has(v));
    for (const v of fresh) bound.add(v);
    const wasExact = exact;
    const wasBits = decimalBits;
    if (system === "sage" && head === "N")
      decimalBits = Math.max(
        SAGE_DECIMAL_BITS,
        typeof operands[1] === "number" ? Math.ceil(operands[1] * 3.33) + 64 : 0,
      );
    if (system === "mpmath" && head === "N" && typeof operands[1] === "number" && operands[1] > 15) exact = true;
    try {
      return walkCall(head, operands);
    } finally {
      exact = wasExact;
      decimalBits = wasBits;
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
      const items = node
        .slice(1)
        .map((el) => threadOver(el, template, others, threadArg))
        .join(", ");
      if (system === "rust") return `list(vec![${items}])`;
      // Julia's `[1, true]` promotes to one element type; `Any[...]` keeps each as it is.
      return `${system === "julia" ? "Any" : ""}[${items}]`;
    }
    const parts = [...others];
    parts.splice(threadArg - 1, 0, walk(node));
    return fill(template, parts);
  };

  const walkCall = (head: string, operands: readonly MathJSON[]): string => {
    const qualified = head === "MemberCall" ? qualifiedName(operands) : undefined;
    // The generic walk below would hand `toWolfram` an already-printed operand.
    if (wl && head === "BigO" && operands.length === 1) return bigO(operands[0]!, walk);
    if (qualified !== undefined && mappingFor(qualified, operands.length - 2, extra, system) !== undefined)
      return walkCall(qualified, operands.slice(2));
    // A head of a library `extra` maps, with no mapping of its own here: unmapped, not a free
    // `MemberCall` the system would answer as written.
    if (
      qualified !== undefined &&
      extra.some((m) => m.head.startsWith(`${qualified.slice(0, qualified.indexOf("."))}.`))
    ) {
      missing.push(`${qualified}/${operands.length - 2}`);
      return "0";
    }
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
    if (wl && (head === "CycleDecomposition" || head === "Permutation") && operands.length === 1) {
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
    if (wl && head === "Thread" && operands.length === 1) {
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
    if (wl && head === "Sign" && operands.length === 1) {
      const inner = operands[0];
      if (isCall(inner) && inner[0] === "Permutation") {
        return toWolfram([head, ...operands] as Parameters<typeof toWolfram>[0]);
      }
    }
    // The SymPy mapping is the permutation inverse; any other `Inverse` (a matrix, a word) is not that.
    if (system === "sympy" && head === "Inverse" && operands.length === 1) {
      const inner = operands[0] as MathJSON;
      if (!(isCall(inner) && inner[0] === "Permutation")) {
        missing.push("Inverse/1");
        return "0";
      }
    }
    // SymPy's `summation(f, (k, a, b))`: the iterator is a tuple, from 1 when its start is `Nothing` or left out.
    // Sage's `sum(f, k, a, b)` and `product(f, k, a, b)` take the iterator's parts as arguments, k a symbol.
    if (
      (system === "sympy"
        ? head === "Sum"
        : system === "sage" && (head === "Sum" || head === "Product") && !extra.some((m) => m.head === head)) &&
      operands.length === 2
    ) {
      const iterator = operands[1] as MathJSON;
      const bounds = isCall(iterator) ? iterator.slice(2) : [];
      if (
        isCall(iterator) &&
        (iterator[0] === "Limits" || iterator[0] === "Tuple" || iterator[0] === "List") &&
        typeof iterator[1] === "string" &&
        (bounds.length === 1 || bounds.length === 2)
      ) {
        const [from, to] = bounds.length === 1 ? [1, bounds[0]] : bounds;
        const range = [iterator[1], from === "Nothing" ? 1 : from, to].map((part) => walk(part as MathJSON));
        const summation = mappingFor(head, 2, extra, system)?.emit[system];
        if (summation !== undefined)
          return fill(summation, [
            walk(operands[0] as MathJSON),
            system === "sage" ? range.join(", ") : `(${range.join(", ")})`,
          ]);
      }
    }
    // A derivative ours holds at a point (`Series` coefficients): `Apply(Derivative(f, o1, …), a1, …)` is f
    // differentiated o_i times in its i-th argument, there. The differentiated arguments are symbols of their own,
    // substituted afterwards.
    if ((system === "sympy" || system === "sage") && head === "Apply" && operands.length >= 2) {
      const callee = operands[0] as MathJSON;
      const orders = isCall(callee) && callee[0] === "Derivative" ? callee.slice(2) : [];
      if (
        isCall(callee) &&
        typeof callee[1] === "string" &&
        orders.length === operands.length - 1 &&
        orders.every((order) => Number.isInteger(order) && (order as number) >= 0)
      ) {
        const names = orders.map((order) => (order === 0 ? undefined : `_d${++derivatives}`));
        const differentiated = names.filter((name): name is string => name !== undefined);
        const real = names.every((name, i) => name === undefined || isRealNumber(operands[i + 1] as MathJSON));
        // Sage differentiates Abs and sign as it would on the line whatever the point: off it, no answer.
        if (system === "sage" && !real && NON_HOLOMORPHIC.has(callee[1] as string)) {
          missing.push(`${head}/derivative-at-a-complex-point`);
          return "0";
        }
        for (const name of differentiated) {
          bound.add(name);
          if (real) realDummies.add(name);
        }
        try {
          const body = walk([callee[1], ...names.map((name, i) => name ?? operands[i + 1]!)] as MathJSON);
          if (differentiated.length === 0) return body;
          const steps = names.flatMap((name, i) =>
            name === undefined
              ? []
              : [
                  system === "sage"
                    ? `${walk(name)}, ${orders[i] as number}`
                    : `(${walk(name)}, ${orders[i] as number})`,
                ],
          );
          const points = names.flatMap((name, i) =>
            name === undefined ? [] : [`${walk(name)}: ${walk(operands[i + 1] as MathJSON)}`],
          );
          return `(diff(${body}, ${steps.join(", ")})).subs({${points.join(", ")}})`;
        } finally {
          for (const name of differentiated) {
            bound.delete(name);
            realDummies.delete(name);
          }
        }
      }
    }
    // The mapped MatrixFunction already simplifies each entry, and `simplify` does not take a list.
    if (
      system === "sympy" &&
      (head === "Simplify" || head === "FullSimplify") &&
      operands.length === 1 &&
      isCall(operands[0] as MathJSON) &&
      (operands[0] as readonly MathJSON[])[0] === "MatrixFunction"
    )
      return walk(operands[0] as MathJSON);
    // SymPy's `Matrix.analytic_func(f(x), x)` takes f as an expression of one variable: a head's name, a
    // Function's body, or an undefined name as an unknown function of it.
    if (system === "sympy" && head === "MatrixFunction" && operands.length === 2) {
      const template = mappingFor(head, 2, extra, system)?.emit[system];
      const [f, matrix] = operands as [MathJSON, MathJSON];
      const variable = "_mf";
      const slot = (node: MathJSON, name: string): MathJSON =>
        node === name
          ? variable
          : isCall(node)
            ? (node.map((part, i) => (i === 0 ? part : slot(part, name))) as MathJSON)
            : node;
      let body: MathJSON | undefined;
      if (typeof f === "string") body = DEFINED_NAMES.has(f) || f.startsWith("_") ? [f, variable] : undefined;
      else if (isCall(f) && f[0] === "Function") {
        const inner = f[1] as MathJSON;
        const unwrapped = isCall(inner) && inner[0] === "Block" ? (inner[1] as MathJSON) : inner;
        body = slot(unwrapped, typeof f[2] === "string" ? f[2] : "_1");
      }
      if (template !== undefined && (body !== undefined || typeof f === "string")) {
        bound.add(variable);
        try {
          const source = body === undefined ? `Function(${JSON.stringify(f)})(${walk(variable)})` : walk(body);
          return fill(template, [source, walk(matrix)]);
        } finally {
          bound.delete(variable);
        }
      }
    }
    // SymPy's `integrate(f, (x, a, b))`: a bare variable (or `Limits(x, Nothing, Nothing)`) is an indefinite
    // integral. Our first limit is the outermost, as Wolfram's; SymPy's first is the innermost.
    if ((system === "sympy" || system === "sage") && head === "Integrate" && operands.length >= 2) {
      const [integrand, ...specs] = operands as [MathJSON, ...MathJSON[]];
      const function_ = isCall(integrand) && integrand[0] === "Function" ? integrand : undefined;
      const wrapped = function_?.[1] as MathJSON | undefined;
      const body =
        function_ === undefined
          ? integrand
          : isCall(wrapped as MathJSON) && (wrapped as readonly MathJSON[])[0] === "Block"
            ? (wrapped as readonly MathJSON[])[1]!
            : wrapped!;
      const iterators = specs.map((spec) => {
        if (typeof spec === "string") return walk(spec);
        if (isCall(spec) && ["Limits", "Tuple", "List"].includes(spec[0] as string) && spec.length === 4) {
          const [, name, from, to] = spec as unknown as [string, MathJSON, MathJSON, MathJSON];
          if (typeof name === "string")
            return from === "Nothing" && to === "Nothing"
              ? walk(name)
              : system === "sage"
                ? [name, from, to].map((part) => walk(part)).join(", ")
                : `(${[name, from, to].map((part) => walk(part)).join(", ")})`;
        }
        return undefined;
      });
      const integral = mappingFor(head, operands.length, extra, system)?.emit[system];
      if (integral !== undefined && iterators.every((iterator) => iterator !== undefined)) {
        // Sage integrates one variable at a time, the last iterator innermost.
        if (system === "sage")
          return (iterators as string[])
            .toReversed()
            .reduce((inner, iterator) => fill(integral, [inner, iterator]), walk(body));
        return fill(integral, [walk(body), ...(iterators as string[]).toReversed()]);
      }
    }
    // Without an iterator `integrate(f)` would pick the variable itself.
    if ((system === "sympy" || system === "sage") && head === "Integrate" && operands.length < 2) {
      missing.push(`${head}/${operands.length}`);
      return "0";
    }
    // A series SymPy answers with its O-term: `Normal` is `removeO`, and its simplifier leaves the O alone.
    if (
      system === "sympy" &&
      ["Normal", "Simplify", "FullSimplify"].includes(head) &&
      operands.length === 1 &&
      seriesCall(operands[0] as MathJSON) !== undefined
    ) {
      const series = walk(operands[0] as MathJSON);
      return head === "Normal" ? `(${series}).removeO()` : `simplify(${series})`;
    }
    // Sage's series answers its Order term too: `Normal` is its `truncate()`.
    if (
      system === "sage" &&
      ["Normal", "Simplify", "FullSimplify"].includes(head) &&
      operands.length === 1 &&
      seriesCall(operands[0] as MathJSON) !== undefined
    ) {
      const series = walk(operands[0] as MathJSON);
      return head === "Normal" ? `(${series}).truncate()` : series;
    }
    // factorrat takes rationals; a Gaussian integer is not one, and SymPy has no factorization of it to ask for.
    if (system === "sympy" && head === "FactorInteger" && operands.length === 1) {
      const operand = operands[0] as MathJSON;
      if (isCall(operand) && operand[0] === "Complex") {
        missing.push("FactorInteger/Complex");
        return "0";
      }
    }
    // A query that reads vertex numbers of a graph Sage numbers otherwise than ours would compare under two numberings.
    if (
      system === "sage" &&
      NUMBERED_QUERIES.has(head) &&
      operands.some((op) => mentions(op as MathJSON, UNSORTED_GRAPHS))
    ) {
      missing.push(`${head}/numbering`);
      return "0";
    }
    // A graph is Sage's Graph or DiGraph, by its edges; loops and parallel edges are kept, as ours keeps them.
    if (system === "sage" && head === "Graph" && (operands.length === 1 || operands.length === 2)) {
      const edges = operands[operands.length - 1] as MathJSON;
      const kinds =
        isCall(edges) && edges[0] === "List" ? new Set(edges.slice(1).map((e) => (isCall(e) ? e[0] : ""))) : undefined;
      const directed = kinds?.has("DirectedEdge") === true;
      if (
        kinds === undefined ||
        [...kinds].some((kind) => kind !== "UndirectedEdge" && kind !== "DirectedEdge") ||
        (directed && kinds.has("UndirectedEdge"))
      ) {
        missing.push(`${head}/${operands.length}`);
        return "0";
      }
      const list = walk(edges);
      const constructor = directed ? "DiGraph" : "Graph";
      return operands.length === 1
        ? `${constructor}(${list}, format="list_of_edges", loops=True, multiedges=True)`
        : `${constructor}([${walk(operands[0] as MathJSON)}, ${list}], format="vertices_and_edges", loops=True, multiedges=True)`;
    }
    // A statistic by name, on the carrier it is of: Sage builds the object the carrier names (run.ts).
    if (system === "sage" && head === "CombinatorialStat" && operands.length === 2) {
      const [object, label] = operands as [MathJSON, MathJSON];
      const name = typeof label === "string" && /^'.*'$/s.test(label) ? label.slice(1, -1) : undefined;
      if (
        isCall(object) &&
        object.length === 2 &&
        name !== undefined &&
        SAGE_STATS[object[0] as string]?.[name] !== undefined
      )
        return `enumeratio_stat(${JSON.stringify(object[0])}, ${walk(object[1] as MathJSON)}, ${JSON.stringify(name)})`;
      missing.push(`${head}/${operands.length}`);
      return "0";
    }
    const mapping = mappingFor(head, operands.length, extra, system);
    let template = mapping?.emit[system];
    if (system === "sympy" && template !== undefined) {
      const first = operands[0] as MathJSON;
      // `S()` would lift a residue class to its integer: a GF element stays one through Power and Divide.
      if ((head === "Power" || head === "Divide") && isResidue(first)) template = template.replace("S($1)", "$1");
      // SymPy's `Abs` leaves an AccumBounds held; Python's `abs()` takes its absolute value.
      if (head === "Abs" && isCall(first) && first[0] === "Interval") template = "abs($1)";
      // PowerMod runs over SymPy's ZZ, which takes integers only (a rational or Gaussian operand is a coercion
      // error there; `pow` on SymPy numbers would only hold `Mod(...)` unreduced, or expand a huge power). A
      // rational exponent is a modular root, as PowerModList; a symbol (a summand's variable) goes to `pow` itself.
      if (head === "PowerMod" && operands.length === 3) {
        const exponent = operands[1] as MathJSON;
        if (isCall(exponent) && exponent[0] === "Rational") template = POWER_MOD_ROOT;
        else if (operands.some((operand) => hasSymbol(operand as MathJSON))) template = "pow(S($1), $2, $3)";
      }
    }
    if (template !== undefined) {
      if (system === "combinatorica") fromCombinatorica = true;
      const only = mapping?.threadArgOnly?.[system];
      const isList = (op: MathJSON | undefined): boolean => op !== undefined && isCall(op) && op[0] === "List";
      // Several candidates: the first operand among them that holds a list.
      const threadArg =
        only === undefined
          ? mapping?.threadArg
          : typeof only === "number"
            ? only
            : (only.find((at) => isList(operands[at - 1] as MathJSON)) ?? only[0]);
      const threaded = threadArg !== undefined ? operands[threadArg - 1] : undefined;
      // With two list operands `threadOver` would thread one and leave the other a list in every
      // call (`gcd([2, 4], 6)`); the Python family broadcasts them together instead.
      const lists = operands.filter((op) => isCall(op) && op[0] === "List").length;
      const broadcastBoth = lists > 1 && threadArg !== undefined && PYTHON_FAMILY.includes(system);
      if (
        threadArg !== undefined &&
        threaded !== undefined &&
        THREADS_MANUALLY.includes(system) &&
        !broadcastBoth &&
        isCall(threaded) &&
        threaded[0] === "List"
      ) {
        const others = operands.filter((_op, i) => i !== threadArg - 1).map((op) => walk(op));
        return threadOver(threaded, template, others, threadArg);
      }
      // Arithmetic over a list: Python's `+` concatenates and `*` repeats, where compute-engine
      // and Wolfram work element by element.
      if (
        (BROADCAST_HEADS.has(head) || broadcastBoth) &&
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
    if (wl && (head === "Module" || head === "With") && operands.length === 2) {
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
    if (wl && head === "Function" && isCall(operands[0]) && operands[0][0] === "Block") {
      return walk([head, ...operands[0].slice(1), ...operands.slice(1)] as MathJSON);
    }
    // An integrand, summand or factor is canonically a Function of the iteration variable;
    // Wolfram takes the body itself, over its iterator.
    if (wl && ["Integrate", "Sum", "Product"].includes(head) && isCall(operands[0])) {
      const [f, ...rest] = operands;
      if (f[0] === "Function") {
        const body = isCall(f[1]) && f[1][0] === "Block" ? f[1][1] : f[1];
        return walk([head, body, ...rest] as MathJSON);
      }
    }
    // An iterator: `Limits(x, a, b)` is `{x, a, b}`; `Limits(x, Nothing, b)`, a sum from 1,
    // is `{x, b}`; `Limits(x, Nothing, Nothing)`, an indefinite integral's, is `x` alone.
    if (wl && head === "Limits" && operands.length === 3) {
      const [x, a, b] = operands;
      if (a === "Nothing" && b === "Nothing") return walk(x!);
      return `List[${(a === "Nothing" ? [x!, b!] : [x!, a!, b!]).map(walk).join(", ")}]`;
    }
    // An option key (`Graph(…, EdgeWeight -> w)`) names the option, Wolfram's own where the head is
    // the same function, so it is not a free variable. `Over` is ours: translated where Wolfram has
    // the ring as an option, ours alone (contexted) where it doesn't. Canonical form writes
    // the option `Over -> R` as `Tuple(Over, R)`.
    if (
      wl &&
      (head === "Rule" || head === "KeyValuePair" || (head === "Tuple" && operands[0] === "Over")) &&
      operands.length === 2 &&
      typeof operands[0] === "string" &&
      isSystemName(operands[0]) &&
      !DEFINED_NAMES.has(operands[0]) &&
      !(operands[0] in CONSTANTS) &&
      !bound.has(operands[0])
    ) {
      const [key, value] = operands as [string, MathJSON];
      // `Over -> QuotientRing(Integers, p)` is `Modulus -> p`: the ring itself has no Wolfram value.
      if (
        key === "Over" &&
        isCall(value) &&
        value[0] === "QuotientRing" &&
        value[1] === "Integers" &&
        value.length === 3
      )
        return `Rule[Modulus, ${walk(value[2]!)}]`;
      const valueSource = walk(value);
      if (key === "Over") return ringOption(key, valueSource) ?? `Rule[${wolframFree(key)}, ${valueSource}]`;
      return toWolfram([head, key, valueSource]);
    }
    // Wolfram has a whole transpiler behind it; a signature row here only overrides it.
    // The operands are already Wolfram source, and `toWolfram` passes an unknown bare
    // symbol through verbatim, so handing them back as symbols yields the head's shape.
    if (wl && isWolframHead(head)) return toWolfram([head, ...operands.map(walk)]);
    // An undefined head used AS a function — `Y(x)` for DSolveValue's unknown solution `Y` —
    // is the same "free variable" case as a bare undefined symbol, just called instead of
    // referenced. Wolfram reads `Y[x]` with an undefined `Y` exactly as compute-engine means
    // it: an unevaluated symbolic function application, not an error. A pattern-variable-
    // shaped name (`_a`) is excluded for the same reason a bare one is (emit.ts's string
    // branch, above) — this codebase's own convention, not a math name.
    if (system === "wolfram" && !DEFINED_NAMES.has(head) && !(head in CONSTANTS) && !/^_[A-Za-z]/.test(head)) {
      if (isWolframOwnName(head)) return `${toWolfram(head)}[${operands.map(walk).join(", ")}]`;
      free.add(head);
      return `${wolframFree(head)}[${operands.map(walk).join(", ")}]`;
    }
    missing.push(`${head}/${operands.length}`);
    return "0";
  };

  let source = walk(expr);
  // A bare constant beside a nested N (pi <= N(pi, 40)) would otherwise be read at the caller's 53 bits.
  if (system === "mpmath" && nestedDigits > 0) source = `enumeratio_at(lambda: (${source}), ${nestedDigits})`;
  if (missing.length > 0) return { ok: false, missing };
  if (system === "combinatorica" && !fromCombinatorica) return { ok: false, missing: [] };
  return {
    ok: true,
    source,
    ...(free.size > 0 ? { freeSymbols: [...free].toSorted() } : {}),
    ...(renamed.size > 0 ? { renamed: Object.fromEntries(renamed) } : {}),
  };
}

/** Which heads in an expression have no mapping for a system — the work queue. */
/** `ns.Name` for a `MemberCall(ns, "Name", …)`'s first two operands, when they're a name. */
function qualifiedName(operands: readonly MathJSON[]): string | undefined {
  const [receiver, member] = operands;
  if (typeof receiver !== "string" || typeof member !== "string" || !/^'.*'$/s.test(member)) return undefined;
  return `${receiver}.${member.slice(1, -1)}`;
}

export function unmappedHeads(expr: MathJSON, system: System): string[] {
  const result = emit(expr, system);
  return result.ok ? [] : [...new Set(result.missing)];
}
