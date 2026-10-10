// A Wolfram documentation input, as held FullForm, read as one of our examples -- or the reason
// it can't be. An input is kept only when every Wolfram name in it is one we map back to a
// head or symbol of ours, so the example means here what it meant there.

import { GRAPHICS_HEADS } from "@enumeratio/formats";
import { fromWolfram, isSystemName, READ_SYMBOLS, REVERSE_HEADS, SYMBOLS } from "@enumeratio/wolfram";

/** Wolfram's documentation sections, as our page's (`null`: not an example we'd show). */
export const SECTION: Readonly<Record<string, string | null>> = {
  BasicExamples: "Basic",
  Scope: "Scope",
  GeneralizationsExtensions: "Scope",
  Options: "Scope",
  Applications: "Applications",
  PropertiesRelations: "Properties",
  PossibleIssues: "Possible issues",
  NeatExamples: "Neat examples",
  InteractiveExamples: null,
};

/** Names `fromWolfram` reads by shape rather than through `REVERSE_HEADS`. */
const STRUCTURAL = new Set([
  "List",
  "Rational",
  "Complex",
  "Log",
  "Divisible",
  "PolyGamma",
  "Slot",
  "Subscript",
  "Clip",
  "Total",
  "Sum",
  "Product",
  "Integrate",
  "Interval",
  "Mod",
  "Apply",
  "DirectedInfinity",
  "SeriesData",
  "UnsameQ",
  "Reduce",
  "Root",
  "PartitionsP",
  "Signature",
  "Modulus",
]);
const MAPPED_SYMBOLS = new Set([...Object.values(SYMBOLS), ...Object.keys(READ_SYMBOLS)]);

/** Mapped, but not an example: state, timing, output history, randomness, I/O. */
const EFFECTS = new Set([
  "Set",
  "SetDelayed",
  "CompoundExpression",
  "Out",
  "In",
  "Timing",
  "AbsoluteTiming",
  "RepeatedTiming",
  "Print",
  "Echo",
  "Clear",
  "ClearAll",
  "Module",
  "Block",
  "With",
  "SeedRandom",
  "Now",
  "Import",
  "Export",
  // A right side the kernel gave up evaluating.
  "$Aborted",
]);
// Pictures, interactive output and random draws: an example's value here is one expression.
const NOT_A_VALUE = /Plot|Graphics|Show|Chart|Legend|Animate|Manipulate|Image|Sound|Dynamic|Random/;

const PICTURES: ReadonlySet<string> = new Set(GRAPHICS_HEADS);

/**
 * Whether an example is a picture or a control: its head, or the head of its value, is one of formats'
 * graphics heads. Wolfram answers those with a `Graphics` or its own control, so the scan doesn't ask.
 */
export function showsPicture(head: string, expr: unknown): boolean {
  let top = expr;
  while (Array.isArray(top) && top[0] === "N" && top.length === 2) top = top[1];
  return PICTURES.has(head) || (Array.isArray(top) && typeof top[0] === "string" && PICTURES.has(top[0]));
}

export type Adapted = { readonly ok: true; readonly expr: unknown } | { readonly ok: false; readonly reason: string };

const fail = (reason: string): Adapted => ({ ok: false, reason });

/** Strip `HoldComplete[…]` off the kernel's held FullForm. */
const unhold = (held: string): string | undefined => /^HoldComplete\[([\s\S]*)\]$/.exec(held.trim())?.[1];

/** `held` (a `HoldComplete[…]` FullForm) as MathJSON, when every name in it is ours. */
export function adaptInput(held: string): Adapted {
  const text = unhold(held);
  if (text === undefined || text === "") return fail("empty");
  const code = text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
  if (code.includes("\\[")) return fail("named character");
  // `2`100` is 2 to 100 digits; `fromWolfram` would drop the mark and change the question.
  if (/\d`/.test(code)) return fail("precision mark");
  // Every unmapped built-in, sorted, so a report can tell which one alone would unlock an input.
  // A name that isn't a Wolfram built-in is the example's own: a free symbol (`x`, `A`), or,
  // called, a function it leaves undefined (`f[x]`, `F[x]`), which no mapping would unlock.
  const unmapped = new Set<string>();
  const userFunctions = new Set<string>();
  for (const [, name, call] of code.matchAll(/([A-Za-z$][A-Za-z0-9$]*(?:`[A-Za-z$][A-Za-z0-9$]*)*)(\s*\[)?/g)) {
    if (EFFECTS.has(name!) || NOT_A_VALUE.test(name!)) return fail(`effect ${name}`);
    const ours = name! in REVERSE_HEADS || STRUCTURAL.has(name!) || MAPPED_SYMBOLS.has(name!);
    if (ours) continue;
    if (isSystemName(name!) || !/^[A-Za-z][A-Za-z0-9]*$/.test(name!)) unmapped.add(name!);
    else if (call !== undefined) userFunctions.add(name!);
  }
  if (userFunctions.size > 0) return fail(`user function ${[...userFunctions].toSorted().join(" ")}`);
  if (unmapped.size > 0) return fail(`unmapped ${[...unmapped].toSorted().join(" ")}`);
  try {
    return { ok: true, expr: renameConstants(rulesAsRules(fromWolfram(text))) };
  } catch (error) {
    return fail(`parse: ${(error as Error).message}`);
  }
}

// `fromWolfram` reads Wolfram's `Rule` as `KeyValuePair`, right for an option (`Over -> R`), but
// the rules a replacement applies are rules: `Replace[x^2, x^2 -> a + b]` is `Replace(x^2, Rule(…))`.
const REPLACERS = new Set(["Replace", "ReplaceAll", "ReplaceRepeated", "ReplaceList"]);
const asRule = (node: unknown): unknown =>
  !Array.isArray(node)
    ? node
    : node[0] === "KeyValuePair"
      ? ["Rule", ...node.slice(1)]
      : node[0] === "List"
        ? node.map((x, i) => (i === 0 ? x : asRule(x)))
        : node;
function rulesAsRules(expr: unknown): unknown {
  if (!Array.isArray(expr)) return expr;
  const walked = expr.map((x, i) => (i === 0 ? x : rulesAsRules(x)));
  return REPLACERS.has(walked[0] as string) && walked.length >= 3
    ? walked.map((x, i) => (i === 2 ? asRule(x) : x))
    : walked;
}

// A bare `i` or `e` is the imaginary unit or Euler's number to our engine, but Wolfram's `I`
// and `E` are those, and its documentation uses `i` and `e` as plain variables: a loop index, a
// list element. Each becomes a letter the example doesn't use, so it stays a variable.
const CONSTANT_LETTERS = ["i", "e"];
const SPARE_LETTERS = "kmnpqrstuvwxyzjabcdgh".split("");

const symbolsOf = (expr: unknown, out = new Set<string>()): Set<string> => {
  if (typeof expr === "string") out.add(expr);
  else if (Array.isArray(expr)) for (const child of expr) symbolsOf(child, out);
  return out;
};

function renameConstants(expr: unknown): unknown {
  const used = symbolsOf(expr);
  const renames = new Map<string, string>();
  for (const letter of CONSTANT_LETTERS) {
    if (!used.has(letter)) continue;
    const spare = SPARE_LETTERS.find((l) => !used.has(l) && ![...renames.values()].includes(l));
    if (spare !== undefined) renames.set(letter, spare);
  }
  if (renames.size === 0) return expr;
  const walk = (node: unknown): unknown =>
    typeof node === "string" ? (renames.get(node) ?? node) : Array.isArray(node) ? node.map(walk) : node;
  return walk(expr);
}

/** Whether `head` appears in `expr`, applied or (a constant) on its own. */
export function mentions(expr: unknown, head: string): boolean {
  if (!Array.isArray(expr)) return expr === head;
  return expr.some((child) => mentions(child, head));
}

/** Heads that restate their argument: one that comes back as its argument did nothing. */
const REWRITES = new Set([
  "FunctionExpand",
  "Simplify",
  "FullSimplify",
  "Expand",
  "Factor",
  "Together",
  "Apart",
  "ComplexExpand",
  "PowerExpand",
  "TrigExpand",
  "TrigReduce",
]);
/** Heads whose documented examples are true statements: one we don't reduce to `True` is a gap. */
const CLAIMS = new Set([
  "Equal",
  "NotEqual",
  "Less",
  "Greater",
  "LessEqual",
  "GreaterEqual",
  "And",
  "Or",
  "Not",
  "Element",
]);

const headOf = (x: unknown): unknown => (Array.isArray(x) ? x[0] : undefined);
const isFloat = (x: unknown): boolean =>
  typeof x === "number"
    ? !Number.isInteger(x)
    : typeof x === "object" && x !== null && !Array.isArray(x)
      ? /[.eE]|NaN|Infinity/.test(JSON.stringify((x as { num?: unknown }).num ?? ""))
      : Array.isArray(x) && x.some(isFloat);

/** What our `value` for a documentation input says: an example worth keeping, a gap (we
 * didn't do what Wolfram's documentation shows), or a suspect answer (a float from exact
 * input, NaN) that is more likely a bug of ours than an example. `same` compares two
 * expressions canonically. */
export function judge(
  expr: unknown,
  value: unknown,
  same: (a: unknown, b: unknown) => boolean,
): "keep" | { gap: string } | { suspect: string } {
  if (mentions(value, "NaN") && !mentions(expr, "NaN")) return { suspect: "NaN" };
  if (isFloat(value) && !isFloat(expr) && !mentions(expr, "N")) return { suspect: "float from exact input" };
  if (same(value, expr)) return { gap: "unevaluated" };
  let core = expr;
  while (REWRITES.has(headOf(core) as string) && Array.isArray(core)) {
    if (same(value, core[1])) return { gap: `${core[0]} did nothing` };
    core = core[1];
  }
  if (CLAIMS.has(headOf(core) as string) && value !== "True") return { gap: "claim not shown True" };
  if (mentions(expr, "D") && mentions(value, "Derivative")) return { gap: "derivative unevaluated" };
  if (mentions(value, "CenteredInterval")) return { gap: "interval unevaluated" };
  return "keep";
}

/** Where a mismatch with Wolfram most likely comes from, as a first pass for triage. */
export type Bucket = "adapt" | "emit" | "compare" | "ours?" | "wolfram?" | "unscanned";

export interface Mismatch {
  readonly expr: unknown;
  readonly ours: unknown;
  /** The Wolfram source we emit, absent when the call doesn't emit. */
  readonly in?: string;
  /** What keeps it from emitting: heads with no Wolfram mapping. */
  readonly missing?: readonly string[];
  /** Wolfram's answer, as it prints it (InputForm). */
  readonly wolfram?: string;
  readonly verdict: string;
}

// What a kernel prints for an answer it can't give: a convention, or Wolfram's own gap.
const NO_VALUE = /^(Indeterminate|ComplexInfinity|-?Infinity|DirectedInfinity\[.*\]|Undefined|\$Failed)$/;
const NUMBER = /^-?\d+(\.\d*)?(`[\d.]*)?(\*\^-?\d+)?$/;

/**
 * A first guess at a mismatch's cause. `adapt`: our reading of Wolfram's input left a
 * canonical form (`Block`, `Limits`) we can't emit back. `emit`: Wolfram answered with our call unevaluated, so the
 * call we send is likely not the one we mean. `compare`: both sides give the same number.
 * `wolfram?`: Wolfram has no value, or stays symbolic where we have one. Otherwise `ours?`.
 */
export function bucketOf(row: Mismatch): Bucket {
  if ((row.missing ?? []).some((m) => /^(Block|Limits|Nothing)\//.test(m))) return "adapt";
  if (row.in === undefined || row.in === "" || row.verdict === "unscanned") return "unscanned";
  const wolfram = (row.wolfram ?? "").trim();
  const called = /^([A-Za-z$`]+)\[/.exec(row.in)?.[1];
  if (row.verdict === "error" || (called !== undefined && wolfram.startsWith(`${called}[`))) return "emit";
  const ours = typeof row.ours === "number" ? row.ours : Number((row.ours as { num?: string } | null)?.num);
  if (NUMBER.test(wolfram) && Number.isFinite(ours)) {
    const theirs = Number(wolfram.replace(/`[\d.]*/, "").replace("*^", "e"));
    if (Math.abs(theirs - ours) <= 1e-9 * Math.max(1, Math.abs(theirs))) return "compare";
  }
  if (NO_VALUE.test(wolfram)) return "wolfram?";
  if (row.verdict === "inconclusive" && !/\d/.test(wolfram)) return "wolfram?";
  return "ours?";
}

/** The names a documentation input assigns (`g = Graph[…]`, `f[x_] := …`): a later input in
 * the same section that uses one is a fragment of that session, not an example on its own. */
export const assignedNames = (held: string): string[] =>
  [...held.matchAll(/\b(?:Set|SetDelayed)\[([A-Za-z$][A-Za-z0-9$]*)[,[]/g)].map((m) => m[1]!);
