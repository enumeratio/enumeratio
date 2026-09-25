// MathJSON → source for one external system, or a reason it cannot be done.
//
// Failing loudly and specifically is the whole point. "Could not emit" is useless; "no
// mapping for `RademacherSymbol` at arity 1" tells you which row to add next, and a scan
// that counts those is a work queue rather than a verdict.

import { HEADS, isWolframHead, SYMBOLS, toWolfram } from "@enumeratio/wolfram/src";
import { mappingFor, THREADS_MANUALLY } from "./mappings.ts";
import type { System } from "./systems.ts";

export type MathJSON = number | string | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

export type Emitted =
  | { readonly ok: true; readonly source: string }
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
      // An unknown bare symbol is a free variable; emitting it is fine for SymPy and Sage
      // but meaningless numerically, so treat it as missing rather than guess.
      if (!bound.has(node)) missing.push(`symbol:${node}`);
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
   * Rebuild `node`'s `List` nesting as Python list literals, applying `template` (with
   * `others` filled into every position but `threadArg`) at each leaf — the manual
   * Listable thread `threadArg` asks for on a Python-family system.
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
    // Wolfram has a whole transpiler behind it; a signature row here only overrides it.
    // The operands are already Wolfram source, and `toWolfram` passes an unknown bare
    // symbol through verbatim, so handing them back as symbols yields the head's shape.
    if (system === "wolfram" && isWolframHead(head)) return toWolfram([head, ...operands.map(walk)]);
    missing.push(`${head}/${operands.length}`);
    return "0";
  };

  const source = walk(expr);
  return missing.length > 0 ? { ok: false, missing } : { ok: true, source };
}

/** Which heads in an expression have no mapping for a system — the work queue. */
export function unmappedHeads(expr: MathJSON, system: System): string[] {
  const result = emit(expr, system);
  return result.ok ? [] : [...new Set(result.missing)];
}
