// Sample new examples from the documented ones and run them through the oracle lanes.
//
// Every example a lane maps is a template: its structure stays, and its numeric arguments are
// swapped for values of the same kind, drawn mostly from the edges of a domain — 0, ±1, the
// value beside the template's, its negation, near-poles, tiny and huge magnitudes. Ours is
// evaluated in an isolated worker under a time and memory cap (a sample that runs away is
// skipped, not a hang), then each lane is asked the same MathJSON through the same emit →
// run → compare path as the scan.
//
// A sample that disagrees the way its template already does (a classified row with the same
// verdict) inherits that classification. Anything else is a finding: a template that agrees
// but a sample that doesn't, or a new kind of answer. Findings are for triage — fix ours, fix
// a mapping, or add the case as a classified example (hidden, if it's minor).
//
// The seed is the date, so every ecosystem's job draws the same samples on the same night,
// and any night can be replayed:
//
//   node packages/reference/scripts/oracle-plausible.ts mpmath sympy
//   node packages/reference/scripts/oracle-plausible.ts julia --seed 2026-09-25 --samples 4

import { appendFileSync, writeFileSync } from "node:fs";
import { runCases } from "@enumeratio/evaluation/node";
import { allFamilies, type AnyFamily } from "@enumeratio/combinatorics/collections";
import {
  emit,
  interpretSymbolicAgreement,
  isSymbolicSystem,
  type MathJSON,
  runIn,
  symbolicAgreementSource,
  type System,
  type Verdict,
} from "@enumeratio/oracle";
import { between as edgeBiased } from "@enumeratio/plausible";
import { isSettled } from "@enumeratio/entry";
import { referenceEntries } from "../src/node.ts";
import { cappedVerdicts } from "./oracle-verdict-capped.ts";

const entries = referenceEntries();
const verdicts = cappedVerdicts();

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const systems = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) as System[];
const seed = option("seed") ?? new Date().toISOString().slice(0, 10);
const perTemplate = Number(option("samples") ?? 3);
const strict = args.includes("--strict");

// One system's lane may spend this long before the samples not yet run are declined. The
// Python job (setup and both drift rescans take ~10 of its 30 minutes) runs two lanes, so a
// lane that stalls must not take the other's share.
const LANE_MINUTES = Number(option("lane-minutes") ?? 8);

// ── a seeded generator per template, so samples don't depend on iteration order ──

const hash = (text: string): number => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const generator = (key: string): (() => number) => {
  let a = hash(`${seed}/${key}`);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
type Random = () => number;
const pick = <T>(random: Random, items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const between = (random: Random, lo: number, hi: number): number => lo + Math.floor(random() * (hi - lo + 1));

// ── values, biased to the edges of a domain ──────────────────────────────────────

const integerNear = (random: Random, t: number): number => {
  const span = Math.min(2 * Math.abs(t) + 10, 1e6);
  const edges = [0, 1, -1, 2, -2, t, -t, t + 1, t - 1, 2 * t];
  const value = random() < 0.7 ? pick(random, edges) : between(random, -span, span);
  return Number.isSafeInteger(value) ? value : t;
};
const floatNear = (random: Random, t: number): number => {
  const span = 2 * Math.abs(t) + 2;
  const edges = [0, 0.5, -0.5, 1, -1, -t, t + 1e-9, t - 1e-9, 1e-12, -1e-12, t * 1e6, t / 1e6];
  const value = random() < 0.7 ? pick(random, edges) : Math.round((random() * 2 - 1) * span * 1000) / 1000;
  return Number.isFinite(value) ? value : t;
};

/** A number literal `t`, replaced by one of its kind: an integer stays an integer. */
const numberNear = (random: Random, t: number): number =>
  Number.isInteger(t) ? integerNear(random, t) : floatNear(random, t);

// Heads whose integer arguments are sizes, labels or bases rather than values: resampling
// them builds malformed objects (a diagram missing a point) or huge ones, not edge cases.
// Collection families aren't listed: their declared params say how to draw them (below).
const STRUCTURAL = new Set([
  "Diagram",
  "OrbitDiagram",
  "Permutation",
  "CycleDecomposition",
  "String",
  "GroupBasis",
  "CyclicGroup",
  "DihedralGroup",
  "SymmetricGroupAlgebra",
  "PartitionAlgebra",
  "PlanarPartitionAlgebra",
  "BrauerAlgebra",
  "TemperleyLiebAlgebra",
  "MotzkinAlgebra",
  "RookAlgebra",
  "AdicNumerals",
]);

// A collection family's integer arguments are sizes, not values: resampling them near the
// template's (up to ±1e6) builds enormous families. They're drawn from the family's own
// declared params instead (https://github.com/enumeratio/enumeratio/wiki/Plausible §7), within a small work budget.
const FAMILIES = new Map<string, AnyFamily>(allFamilies.map((f) => [f.head, f]));
const FAMILY_SIZE = 6;
const FAMILY_BUDGET = 20_000n;

/** A family call's params drawn from what it declares; the template's when none fit the budget. */
function familyParams(family: AnyFamily, ops: readonly MathJSON[], random: Random): MathJSON[] {
  const declared = family.declared;
  for (let attempt = 0; attempt < 10; attempt++) {
    const params =
      declared === undefined
        ? ops.map(() => edgeBiased(random, 0, 4)) // not declared yet: stay tiny
        : declared.params.map(({ role, min, max }) =>
            edgeBiased(
              random,
              min,
              Math.min(role === "axis" ? min + FAMILY_SIZE : min + 3, max ?? Number.MAX_SAFE_INTEGER),
            ),
          );
    const enumerates = declared !== undefined && Object.values(declared.cost).includes("enumerative");
    if (enumerates && declared.work !== undefined && declared.work(params) > FAMILY_BUDGET) continue;
    return params;
  }
  return [...ops];
}

/** `expr` with some of its numeric literals resampled; at least one when it has any. */
function mutate(expr: MathJSON, random: Random): MathJSON {
  let changed = false;
  const walk = (node: MathJSON): MathJSON => {
    if (typeof node === "number") {
      if (random() < 0.5) {
        changed = true;
        return numberNear(random, node);
      }
      return node;
    }
    if (!Array.isArray(node) || typeof node[0] !== "string") return node;
    const [head, ...ops] = node as readonly MathJSON[];
    if (STRUCTURAL.has(head as string)) return node;
    if (head === "Rational" && ops.every((op) => Number.isInteger(op))) {
      if (random() < 0.5) {
        changed = true;
        const [p, q] = ops as number[];
        const options: [number, number][] = [
          [-p!, q!],
          [p! + 1, q!],
          [p!, q! + 1],
          [1, 2],
          [-1, 2],
          [1, 3],
        ];
        const [a, b] = pick(random, options);
        return b === 0 ? node : ["Rational", a, b];
      }
      return node;
    }
    if (head === "Complex" && ops.length === 2 && ops.every((op) => typeof op === "number")) {
      if (random() < 0.5) {
        changed = true;
        const [re, im] = ops as number[];
        const angle = random() * 2 * Math.PI;
        const options: [number, number][] = [
          [numberNear(random, re!), numberNear(random, im!)],
          [0, numberNear(random, im!)],
          [Math.cos(angle), Math.sin(angle)], // on the unit circle
          [re!, -im!],
        ];
        const [a, b] = pick(random, options);
        return ["Complex", a, b];
      }
      return node;
    }
    // A Complex part that is itself an expression (`Complex(0, Sqrt(3))`) stays as written:
    // resampling inside it can make a part non-real, which is not a Complex at all.
    if (head === "Complex") return node;
    // A non-negative integer exponent building a big power (Power(10, 100)) must stay
    // non-negative: flipping its sign turns an intended huge integer into a tiny fraction,
    // which breaks every integer-only downstream head (LCM, IsPrime, Mod, GCD, PowerMod, ...).
    if (head === "Power" && ops.length === 2 && Number.isInteger(ops[1]) && (ops[1] as number) >= 0) {
      const base = walk(ops[0] as MathJSON);
      if (random() < 0.5) {
        changed = true;
        return [head, base, Math.abs(numberNear(random, ops[1] as number))] as MathJSON;
      }
      return [head, base, ops[1] as number];
    }
    const family = FAMILIES.get(head as string);
    if (family !== undefined && ops.length === family.paramCount && ops.every((op) => Number.isInteger(op))) {
      if (random() < 0.5) {
        changed = true;
        return [head, ...familyParams(family, ops, random)] as MathJSON;
      }
      return node;
    }
    // The first operand of AdicNumeral is its base: keep it, resample the value.
    if (head === "AdicNumeral") return [head, ops[0] as MathJSON, ...ops.slice(1).map(walk)];
    return [head, ...ops.map(walk)] as MathJSON;
  };
  const out = walk(expr);
  return changed ? out : walk(expr);
}

// ── templates and samples ────────────────────────────────────────────────────────

interface Template {
  readonly id: string;
  readonly expr: MathJSON;
  readonly others: Readonly<Record<string, { verdict: string; kind?: string }>>;
}
interface Sample {
  readonly id: string;
  readonly template: Template;
  readonly expr: MathJSON;
}

const templates: Template[] = entries.flatMap((entry) =>
  entry.examples
    .filter((example) => isSettled(example) && example.volatile === undefined)
    .filter((example) => systems.some((system) => emit(example.expr as MathJSON, system).ok))
    .map((example) => ({
      id: `${entry.name}/${example.id}`,
      expr: example.expr as MathJSON,
      others: (example.others ?? {}) as Template["others"],
    })),
);

// A classified row covers the region of inputs it sits in, not only its own template: a sample
// of the same entry whose numbers fall in the same sign/kind classes (a negative integer beside
// a positive one, a zero modulus, ...) inherits the row's verdict and kind.
function region(expr: MathJSON): Set<string> {
  const classes = new Set<string>();
  const walk = (node: MathJSON): void => {
    if (typeof node === "number") classes.add(`${Math.sign(node)}${Number.isInteger(node) ? "i" : "f"}`);
    else if (typeof node === "string") classes.add("sym");
    else if (Array.isArray(node)) {
      const [head, ...ops] = node as readonly MathJSON[];
      if (head === "Rational" && ops.every((op) => typeof op === "number"))
        classes.add(`${Math.sign((ops[0] as number) * (ops[1] as number))}r`);
      else if (head === "Complex") classes.add("c");
      else for (const op of ops) walk(op);
    }
  };
  walk(expr);
  return classes;
}
// A row covers a sample whose classes include all of its own; a row of plain positive integers
// (nothing out of the ordinary to name a convention by) covers only samples of exactly that.
const covers = (row: Set<string>, sample: Set<string>): boolean =>
  [...row].every((c) => sample.has(c)) && (sample.size === row.size || row.size > 1 || !row.has("1i"));
const regions = new Map<string, Set<string>[]>();
for (const entry of entries)
  for (const example of entry.examples)
    for (const [system, run] of Object.entries(example.others ?? {})) {
      if (run.kind === undefined) continue;
      const key = `${entry.name}/${system}/${run.verdict}`;
      regions.set(key, [...(regions.get(key) ?? []), region(example.expr as MathJSON)]);
    }

const samples: Sample[] = [];
for (const template of templates) {
  const random = generator(template.id);
  const seen = new Set([JSON.stringify(template.expr)]);
  for (let k = 0; k < perTemplate * 3 && seen.size <= perTemplate; k++) {
    const expr = mutate(template.expr, random);
    const key = JSON.stringify(expr);
    if (seen.has(key)) continue;
    seen.add(key);
    samples.push({ id: `${template.id}~${seen.size - 1}`, template, expr });
  }
}
process.stderr.write(`seed ${seed}: ${samples.length} samples from ${templates.length} templates — evaluating ours…\n`);

// Ours, each sample isolated and capped: a runaway sample is skipped, not a hang.
const ours = await runCases(
  samples.map((sample) => ({ id: sample.id, input: sample.expr })),
  {
    setup: new URL("./engines.ts", import.meta.url).href,
    timeMs: 2_000,
    memoryBytes: 256 * 1024 * 1024,
    materialize: true,
    concurrency: 3,
  },
);
const expectedOf = new Map(ours.filter((r) => r.outcome === "Evaluated").map((r) => [r.id, r.value as MathJSON]));

// ── each lane ────────────────────────────────────────────────────────────────────

/** Ours' names for a non-answer, and what other systems say when they reach one. */
const UNDEFINED = new Set(["ComplexInfinity", "PositiveInfinity", "NegativeInfinity", "NaN", "Indeterminate"]);
const POLE =
  /pole|infinit|ZeroDivision|DivideError|division by zero|divide by zero|integer division|modulo by zero|undefined/i;
const RESOURCE = /TimeoutError|MemoryError|KernelDied|killed|\$Aborted/;
/** The other system refusing an argument outside its function's domain. */
const DOMAIN =
  /DomainError|non-?negative|must be positive|positive integer|not an integer|an integer, not|zero modulus|expected|expecting|MethodError|AssertionError|cannot create mpf/i;

/** Whether `ours` is a list of numbers and booleans that `theirs` prints with the booleans as 0 and 1. */
function boolsAsInts(ours: MathJSON, theirs: string): boolean {
  if (!Array.isArray(ours) || ours[0] !== "List") return false;
  const asNumbers = ours.slice(1).map((item) => (item === "True" ? 1 : item === "False" ? 0 : item));
  try {
    return JSON.stringify(asNumbers) === JSON.stringify(JSON.parse(theirs));
  } catch {
    return false;
  }
}

/** A value as its parts: a real, or a Python complex literal `(a+bj)`, or ours' `Complex`. */
function parts(value: unknown): number[] | undefined {
  if (typeof value === "number") return [value];
  if (Array.isArray(value) && value[0] === "Complex" && value.length === 3)
    return typeof value[1] === "number" && typeof value[2] === "number" ? [value[1], value[2]] : undefined;
  if (typeof value !== "string") return undefined;
  const complex = /^\(?\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([-+]\s*[\d.]+(?:e[-+]?\d+)?)j\)?$/i.exec(value.trim());
  if (complex !== null) return [Number(complex[1]), Number((complex[2] as string).replace(/\s/g, ""))];
  const real = Number(value);
  return value.trim() !== "" && Number.isFinite(real) ? [real] : undefined;
}

/** Whether two numbers, real or complex, are within 1e-9 of each other relative to their size. */
function agreesInNorm(ours: MathJSON, theirs: string): boolean {
  const [a, b] = [parts(ours), parts(theirs)];
  if (a === undefined || b === undefined) return false;
  const [ar, ai = 0] = a;
  const [br, bi = 0] = b;
  return Math.hypot(ar - br, ai - bi) <= 1e-9 * Math.max(Math.hypot(ar, ai), Math.hypot(br, bi));
}

/** Whether two values differ by a Gaussian unit (1, -1, i or -i). */
function associates(ours: MathJSON, theirs: string): boolean {
  const [a, b] = [parts(ours), parts(theirs)];
  if (a === undefined || b === undefined) return false;
  const [ar, ai = 0] = a;
  const [br, bi = 0] = b;
  const close = (x: number, y: number) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  return [
    [br, bi],
    [-br, -bi],
    [-bi, br],
    [bi, -br],
  ].some(([r, i]) => close(r as number, ar) && close(i as number, ai));
}

/** Whether `theirs` (full precision) rounds to `ours` at the precision `N` was asked for: `d`
 * significant figures, or for `{precision, accuracy}` that many decimals. */
function roundsTo(spec: MathJSON, ours: MathJSON, theirs: string): boolean {
  const mine = parts(ours);
  const other = parts(theirs);
  if (mine === undefined || other === undefined || mine.length !== other.length) return false;
  const accuracy = Array.isArray(spec) && spec[0] === "List" ? spec[2] : undefined;
  const digits = typeof spec === "number" ? spec : Array.isArray(spec) && spec[0] === "List" ? spec[1] : undefined;
  return other.every((x, i) => {
    let scale: number;
    if (typeof accuracy === "number") scale = 10 ** accuracy;
    else if (typeof digits === "number") scale = x === 0 ? 1 : 10 ** (digits - 1 - Math.floor(Math.log10(Math.abs(x))));
    else return false;
    return (
      Math.abs(Math.round(x * scale) / scale - (mine[i] as number)) <= 1e-9 * Math.max(1, Math.abs(mine[i] as number))
    );
  });
}

/** The kinds a sample earns without a person: both sides decline, in different words, or the
 * other system ran out of time or memory. Anything else is a finding. */
function autoKind(
  sample: MathJSON,
  ours: MathJSON,
  result: { value?: string; error?: string },
  source: string,
  system: System,
): string | undefined {
  const theirs = result.error ?? result.value ?? "";
  // The crate takes scalars where ours threads over a list.
  if (result.error !== undefined && /threading|::Vector/i.test(theirs)) return "threading";
  // Julia's array literal promotes a Bool beside an Int, so `[false, -1]` prints `[0, -1]`.
  if (result.error === undefined && boolsAsInts(ours, theirs)) return "convention";
  // A double can't hold the exact huge argument that ours reduces exactly.
  if (system === "rust" && result.error === undefined && callsTrig(sample) && hasHugeInteger(sample))
    return "precision";
  if (result.error !== undefined && RESOURCE.test(theirs)) return "resource";
  // Our own worker hit its time or memory cap on this sample (an extreme edge the mutator
  // drew, not the other system): the same "nothing to compare" shrug, from our side.
  if (ours === "Aborted") return "resource";
  // `N(expr, d)`: the mapping drops the digit count and asks the other system for full
  // precision instead (a numeric-tolerance comparison is the better general witness — see
  // the N/2 mapping's own note), so a low `d` disagrees whenever rounding to `d` significant
  // figures actually matters. Not a real disagreement when their full-precision answer
  // rounds to ours at the requested d.
  if (result.error === undefined && Array.isArray(sample) && sample[0] === "N" && sample.length === 3) {
    if (roundsTo(sample[2] as MathJSON, ours, theirs)) return "convention";
  }
  // Unevaluated: the sample itself, or for `N(f(…))` the inner call.
  const inner = Array.isArray(sample) && sample[0] === "N" ? sample[1] : sample;
  const oursDeclines =
    (typeof ours === "string" && UNDEFINED.has(ours)) ||
    [JSON.stringify(sample), JSON.stringify(inner)].includes(JSON.stringify(ours)) ||
    (Array.isArray(ours) && ours[0] === "Error");
  const theirsDeclines =
    (result.error !== undefined && POLE.test(theirs)) ||
    UNDEFINED.has(theirs.trim()) ||
    /^(nan|zoo|oo|-oo|inf|-inf)$/i.test(theirs.trim());
  // Ours already gave up (stayed symbolic, or answered ComplexInfinity/NaN/…): any exception
  // on their side is also a decline, whatever its message happens to say (an internal
  // IndexError from a table lookup, `ComplexResult: logarithm of a negative number`, …) — a
  // recognizable POLE message on top of that is just the common case, not a requirement.
  // A list element that is a non-answer on both sides, each in its own spelling.
  if (
    /"(Indeterminate|NaN|ComplexInfinity)"/.test(JSON.stringify(ours)) &&
    /\b(nan|zoo|oo)\b|NaN|Infinity/i.test(theirs)
  )
    return "undefined-form";
  // Ours stayed unevaluated at some element of a list or sum (a call to a head of the sample,
  // left as it came), which counts as declining the whole.
  const partlyDeclines = !oursDeclines && leavesCallOf(ours, sample);
  if ((oursDeclines || partlyDeclines) && (theirsDeclines || result.error !== undefined)) return "undefined-form";
  // We already gave up (stayed symbolic, or answered ComplexInfinity/NaN/…) and they
  // cleanly computed something: not a pole on either side, just a capability boundary of
  // ours (an order or a branch we haven't extended this far).
  if (oursDeclines || partlyDeclines) return "unevaluated";
  // They echo a call of the very function asked (`lucas(1/2)`, `Mod(1 + 4*I, 2)`): theirs doesn't
  // extend to this argument, where ours answers.
  if (result.error === undefined && echoesCall(theirs, source, sample)) return "domain";
  // Agreement to the size of the whole value: a component far below the dominant one (the
  // real part beside a 1e30 pole term) is rounding noise to a system that keeps it.
  if (result.error === undefined && agreesInNorm(ours, theirs)) return "precision";
  // GCD and LCM are defined up to a unit, and a system may pick another associate.
  if (result.error === undefined && callHeads(sample).has("LCM") && associates(ours, theirs)) return "convention";
  if (result.error === undefined && callHeads(sample).has("GCD") && associates(ours, theirs)) return "convention";
  // They refuse the argument (a pole they haven't continued past, or their own domain
  // error) where ours answers: a domain difference. `theirsDeclines` already covers a pole
  // spelled as an error (ValueError, ZeroDivisionError, "complex infinity", …) or a bare
  // NaN/zoo/oo value; DOMAIN catches the rest (an explicit "not a positive integer" or
  // similar refusal that doesn't read as a pole).
  if (theirsDeclines || (result.error !== undefined && DOMAIN.test(theirs))) return "domain";
  return undefined;
}

const callsTrig = (expr: MathJSON): boolean =>
  [...callHeads(expr)].some((head) => ["Sin", "Cos", "Tan"].includes(head));
/** Whether an integer literal, or a power of integer literals, passes the exact range of a double. */
const hasHugeInteger = (expr: MathJSON): boolean => {
  if (typeof expr === "number") return Math.abs(expr) > 2 ** 53;
  if (!Array.isArray(expr)) return false;
  const [head, ...ops] = expr as readonly MathJSON[];
  if (head === "Power" && typeof ops[0] === "number" && typeof ops[1] === "number")
    return Math.abs(ops[0]) ** ops[1] > 2 ** 53;
  return ops.some(hasHugeInteger);
};

/** Heads that only combine values: a call to one is not a function left unevaluated. */
const COMBINING = new Set([
  "List",
  "N",
  "Add",
  "Subtract",
  "Multiply",
  "Divide",
  "Power",
  "Negate",
  "Rational",
  "Complex",
  "Sqrt",
]);
const callHeads = (expr: MathJSON, into = new Set<string>()): Set<string> => {
  if (Array.isArray(expr) && typeof expr[0] === "string") {
    into.add(expr[0]);
    for (const op of expr.slice(1)) callHeads(op as MathJSON, into);
  }
  return into;
};
/** Whether `ours` holds a call to one of the sample's own (non-combining) heads. */
const leavesCallOf = (ours: MathJSON, sample: MathJSON): boolean => {
  const asked = callHeads(sample);
  return [...callHeads(ours)].some((head) => asked.has(head) && !COMBINING.has(head));
};
/** Whether `theirs` still contains a function call the emitted source made. */
const echoesCall = (theirs: string, source: string, sample: MathJSON): boolean => {
  const functions = new Set([
    ...[...source.matchAll(/([A-Za-z_]\w*)\(/g)].map((m) => m[1] as string),
    ...[...callHeads(sample)].filter((head) => !COMBINING.has(head)),
  ]);
  for (const name of ["N", "S", "Rational", "Integer", "Float", "Symbol", "Abs", "sqrt"]) functions.delete(name);
  return [...functions].some((name) => theirs.includes(`${name}(`));
};

interface Finding {
  readonly system: System;
  readonly id: string;
  readonly expr: MathJSON;
  readonly ours: MathJSON;
  readonly theirs: string;
  readonly verdict: Verdict | "error";
  readonly template: string;
  readonly was: string;
}
const findings: Finding[] = [];
/** Samples a lane declined (its kernel hit a cap or its time budget ran out), by template. */
const declined = new Map<string, { timedOut: number; unrun: number; example: string }>();
const lines: string[] = [
  `## Oracle Plausible — seed \`${seed}\``,
  "",
  `${samples.length} samples from ${templates.length} templates; ours skipped ${samples.length - expectedOf.size} (timed out or raised).`,
  "",
  "| system | sampled | agree | inherited | classified automatically | findings |",
  "| --- | --- | --- | --- | --- | --- |",
];

for (const system of systems) {
  const runnable = samples
    .filter((sample) => expectedOf.has(sample.id))
    .map((sample) => ({ sample, out: emit(sample.expr, system) }))
    .filter((row) => row.out.ok);
  // A free symbol on a symbolic system is judged as an identity (does the difference
  // vanish?), as the scan does: two equal closed forms can be spelled differently.
  const symbolicMode: boolean[] = [];
  // Free symbols whose identity can't be checked because our own answer doesn't emit there.
  const unchecked = new Set<number>();
  const sources = runnable.map((row, index) => {
    const plain = (row.out as { source: string }).source;
    const freeSymbols = row.out.ok ? row.out.freeSymbols : undefined;
    const agreement =
      freeSymbols !== undefined && freeSymbols.length > 0 && isSymbolicSystem(system)
        ? symbolicAgreementSource(system, row.sample.expr, expectedOf.get(row.sample.id) as MathJSON, freeSymbols)
        : undefined;
    symbolicMode.push(agreement !== undefined);
    if (agreement === undefined && freeSymbols !== undefined && freeSymbols.length > 0 && isSymbolicSystem(system))
      unchecked.add(index);
    return agreement ?? plain;
  });
  process.stderr.write(`${system}: ${sources.length} samples — running…\n`);
  const results = await runIn(system, sources, { deadline: Date.now() + LANE_MINUTES * 60_000 });
  let agree = 0;
  let inherited = 0;
  let automatic = 0;
  let found = 0;
  const autos = new Map<string, number>();
  for (const [i, row] of runnable.entries()) {
    const result = results[i] as { value?: string; numeric?: string; error?: string };
    const expected = expectedOf.get(row.sample.id) as MathJSON;
    // The comparison evaluates in-process (an uncapped CE call can spin), so it runs capped too.
    const judged =
      result.error !== undefined
        ? "error"
        : symbolicMode[i]
          ? interpretSymbolicAgreement(result.value ?? "")
          : await verdicts.verdict(system, expected, result);
    const slowCompare = judged === "timeout";
    const verdict: Verdict | "error" = slowCompare ? "error" : judged;
    const error = slowCompare ? "TimeoutError: comparison" : result.error;
    if (error?.startsWith("TimeoutError")) {
      const key = `${system} · ${row.sample.template.id}`;
      const entry = declined.get(key) ?? { timedOut: 0, unrun: 0, example: JSON.stringify(row.sample.expr) };
      if (error.includes("lane budget")) entry.unrun++;
      else entry.timedOut++;
      declined.set(key, entry);
      // Declined, not agreement and not a finding.
      autos.set("resource", (autos.get("resource") ?? 0) + 1);
      automatic++;
      continue;
    }
    if (verdict === "agree") {
      agree++;
      continue;
    }
    const baseline = row.sample.template.others[system];
    // The same way the template already differs, and that is classified: nothing new. Or a
    // classified row of the same entry covers the region this sample falls in.
    const entryName = row.sample.template.id.slice(0, row.sample.template.id.indexOf("/"));
    if (
      (baseline !== undefined && baseline.verdict === verdict && baseline.kind !== undefined) ||
      regions.get(`${entryName}/${system}/${verdict}`)?.some((rows) => covers(rows, region(row.sample.expr)))
    ) {
      inherited++;
      continue;
    }
    const auto = unchecked.has(i)
      ? "unchecked"
      : autoKind(row.sample.expr, expected, result, (row.out as { source: string }).source, system);
    if (auto !== undefined) {
      autos.set(auto, (autos.get(auto) ?? 0) + 1);
      automatic++;
      continue;
    }
    found++;
    findings.push({
      system,
      id: row.sample.id,
      expr: row.sample.expr,
      ours: expected,
      theirs: (result.error ?? result.value ?? "").slice(0, 120),
      verdict,
      template: row.sample.template.id,
      was: baseline === undefined ? "unscanned" : `${baseline.verdict}${baseline.kind ? ` (${baseline.kind})` : ""}`,
    });
  }
  const autoText = [...autos].map(([kind, n]) => `${kind} ${n}`).join(", ") || "0";
  lines.push(`| ${system} | ${runnable.length} | ${agree} | ${inherited} | ${autoText} | ${found} |`);
  process.stderr.write(
    `${system}: agree ${agree}, inherited ${inherited}, automatic ${automatic}, findings ${found}\n`,
  );
}

// Declined samples are not agreement: named by template so a slow one is visible.
if (declined.size > 0) {
  const total = (field: "timedOut" | "unrun") => [...declined.values()].reduce((n, d) => n + d[field], 0);
  lines.push("", "### Declined", "");
  lines.push(
    `${total("timedOut")} samples timed out (kernel or comparison); ${total("unrun")} were not run (lane budget ${LANE_MINUTES} min).`,
    "",
  );
  const slow = [...declined].filter(([, d]) => d.timedOut > 0).toSorted((a, b) => b[1].timedOut - a[1].timedOut);
  if (slow.length > 0) {
    lines.push("| template | timed out | a sample |", "| --- | --- | --- |");
    for (const [key, d] of slow.slice(0, 20))
      lines.push(`| ${key} | ${d.timedOut} | \`${d.example.slice(0, 80).replace(/\|/g, "/").replace(/`/g, "'")}\` |`);
  }
}

const cell = (text: string): string => text.replace(/\|/g, "/").replace(/`/g, "'").slice(0, 80);
// Findings grouped by template head: a family shows once, with a few of its samples.
if (findings.length > 0) {
  lines.push("", "### Findings", "");
  const byHead = new Map<string, Finding[]>();
  for (const f of findings) {
    const head = `${f.system} · ${f.template.replace(/#\d+$/, "")}`;
    byHead.set(head, [...(byHead.get(head) ?? []), f]);
  }
  for (const [head, group] of [...byHead].toSorted((a, b) => b[1].length - a[1].length)) {
    lines.push(`<details><summary>${head} — ${group.length}</summary>`, "");
    lines.push("| sample | ours | theirs | verdict | template (its row) |", "| --- | --- | --- | --- | --- |");
    for (const f of group.slice(0, 8)) {
      lines.push(
        `| \`${cell(JSON.stringify(f.expr))}\` | \`${cell(JSON.stringify(f.ours))}\` | \`${cell(f.theirs)}\` | ${f.verdict} | ${f.template} (${f.was}) |`,
      );
    }
    lines.push("", "</details>", "");
  }
}
verdicts.close();
const summary = `${lines.join("\n")}\n`;
process.stdout.write(summary);
if (process.env["GITHUB_STEP_SUMMARY"]) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], summary);
writeFileSync(
  new URL("../golden/oracle/plausible.json", import.meta.url),
  `${JSON.stringify({ seed, systems, samples: samples.length, findings }, null, 2)}\n`,
);
if (strict && findings.length > 0) process.exitCode = 1;
