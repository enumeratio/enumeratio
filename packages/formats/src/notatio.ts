// `notatio` — a restricted subset of Epsil, and the language of the web-component
// attributes (`<notatio-plot value>`, `<notatio-manipulate>` slots, …). It is a
// single expression: the full Epsil surface syntax minus statements and effects
// (no assignment, declarations, control flow, pragmas, or sequences). Parsing and
// serialization lean entirely on compute-engine's own Epsil (`parseEpsil` /
// `serializeEpsil`); this module only adds the subset gate and the slot helpers.
//
// Slots use compute-engine's native pattern notation: a named **wildcard**
// `_name` is a hole filled from the parameter `name` (see `collectWildcards`; the
// element fills them with CE's own `.subs`). `$…$` LaTeX islands are allowed (need a `parseLatex`
// hook via `ce`); inside an island implicit multiplication works, so a product of
// symbols needs an explicit `*` only in the Epsil (non-island) text.

import { type MathJsonExpression, parseEpsil, serializeEpsil } from "@cortex-js/compute-engine/epsil";

/** Heads that make an input a statement/effect rather than a plain expression. */
const STATEMENT_HEADS = new Set([
  "Assign",
  "Declare",
  "Block",
  "Sequence",
  "Do",
  "If",
  "Which",
  "While",
  "Loop",
  "Return",
  "Print",
  "Function", // a lambda is a definition, not a value we plot/substitute
]);

export interface NotatioOptions {
  /** Parses `$…$` LaTeX islands; typically `(tex) => ce.parse(tex).json`. */
  parseLatex?: (latex: string) => MathJsonExpression;
  /**
   * Statement heads to let through anyway -- a notebook cell binds with `Assign`, and
   * is otherwise notatio.
   */
  allow?: Iterable<string>;
}

export interface NotatioResult {
  /** The parsed expression as MathJSON (with Epsil source decorations). */
  json: MathJsonExpression;
  /** Named wildcards present, e.g. `["_a", "_w"]` — the slots to fill. */
  wildcards: string[];
  /** Diagnostic messages; empty iff the input is valid notatio. */
  errors: string[];
}

/** Flatten an Epsil diagnostic message (a string or a `[code, ...args]` tuple). */
const diagText = (m: unknown): string => (Array.isArray(m) ? m.join(" ") : typeof m === "string" ? m : String(m));

/** The function head of a MathJSON node, or undefined if it is not a function. */
const headOf = (node: unknown): string | undefined => {
  if (Array.isArray(node)) return typeof node[0] === "string" ? node[0] : undefined;
  const fn = (node as { fn?: unknown[] })?.fn;
  if (Array.isArray(fn)) return typeof fn[0] === "string" ? fn[0] : undefined;
  return undefined;
};

/** The symbol name of a MathJSON node, or undefined. */
const symOf = (node: unknown): string | undefined => {
  if (typeof node === "string") return node;
  const sym = (node as { sym?: unknown })?.sym;
  return typeof sym === "string" ? sym : undefined;
};

/** Walk every node of a MathJSON tree (arrays and the `{fn:[…]}` object form). */
function walk(node: unknown, visit: (n: unknown) => void): void {
  visit(node);
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
  } else {
    const fn = (node as { fn?: unknown[] })?.fn;
    if (Array.isArray(fn)) for (const child of fn) walk(child, visit);
  }
}

/** A named wildcard is a symbol `_name` (CE's pattern hole); bare `_`/`__` skipped. */
const wildcardName = (sym: string | undefined): string | undefined =>
  sym && /^_[A-Za-z][A-Za-z0-9]*$/.test(sym) ? sym : undefined;

/** The named wildcards in a parsed expression, deduplicated in first-seen order. */
export function collectWildcards(json: MathJsonExpression): string[] {
  const seen = new Set<string>();
  walk(json, (n) => {
    const w = wildcardName(symOf(n));
    if (w) seen.add(w);
  });
  return [...seen];
}

/**
 * Put back the digits each decimal literal was typed with. compute-engine's `parseEpsil`
 * works a short decimal out in doubles, so `0.3` reads as `0.30000000000000004` and prints
 * back that way; a long one it keeps as written. Every literal carries the span it came
 * from, and that text (less its `_` separators) is the value the author meant. A span that
 * doesn't read as the same number -- a node from a `$…$` island, say -- is left alone.
 */
function exactDecimals(json: MathJsonExpression, src: string): void {
  walk(json, (n) => {
    const node = n as { num?: unknown; sourceOffsets?: [number, number] };
    if (typeof node?.num !== "string" || !Array.isArray(node.sourceOffsets)) return;
    const written = src.slice(...node.sourceOffsets).replaceAll("_", "");
    if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(written)) return;
    const [typed, parsed] = [Number(written), Number(node.num)];
    if (typed === parsed || Math.abs(typed - parsed) <= Math.abs(parsed) * 1e-15) node.num = written;
  });
}

/**
 * Parse a notatio (restricted-Epsil) source string. Returns the MathJSON, its
 * slot wildcards, and any diagnostics — an Epsil parse error, or a statement/
 * effect head that the subset forbids. Never throws.
 */
export function parseNotatio(src: string, options?: NotatioOptions): NotatioResult {
  const [json, diagnostics] = parseEpsil(src, undefined, options);
  exactDecimals(json, src);
  const errors = diagnostics.filter((d) => d.severity === "error").map((d) => diagText(d.message));
  const allowed = new Set(options?.allow);
  // A `Cell`'s input is a cell, and a cell may be one `:=` binding (`Cell(a := 5)`).
  const cellBindings = new Set<unknown>();
  walk(json, (n) => {
    if (headOf(n) !== "Cell") return;
    const input = Array.isArray(n) ? n[1] : (n as { fn: unknown[] }).fn[1];
    if (headOf(input) === "Assign") cellBindings.add(input);
  });
  walk(json, (n) => {
    const head = headOf(n);
    if (head && STATEMENT_HEADS.has(head) && !allowed.has(head) && !cellBindings.has(n)) {
      errors.push(`notatio: ${head} is not allowed`);
    }
  });
  return { json, wildcards: collectWildcards(json), errors };
}

/** Serialize MathJSON back to notatio text (Epsil surface syntax). */
export function serializeNotatio(json: MathJsonExpression): string {
  return serializeEpsil(json);
}
