// Checks the claim `HarmonicNumber` warned about in design/roadmap.md §1: the head map
// says the transpiler may emit it, but nothing requires the engine to actually answer it.
// Two ways that can fail, and they are different bugs:
//
//   UNDECLARED   `ce.lookupDefinition(head)` finds nothing at all — the transpiler emits a
//                head that isn't even bound to an operator.
//   UNEVALUATED  the head is declared, but a plausible small sample never produces an
//                actual answer.
//
// "Produces an answer" is judged by the declared signature's RETURN type, not by whether
// `evaluate()` changed the boxed JSON — a naive before/after diff is wrong two different
// ways: `ce.box` itself folds simple arithmetic eagerly (`Multiply(2, 2)` is already `4` by
// the time `evaluate()` sees it, so "unchanged" proves nothing), and several heads (`Range`,
// `Take`, `Most`, …) are lazy collections that stay exactly as boxed and answer through
// `.count`/enumeration rather than rewriting themselves. So the check is return-type-aware:
//
//   numeric return     `.N()` must produce a finite real part (`.re`)
//   collection return  `.evaluate().count` must be a finite number, not `NaN`
//   boolean return     `.evaluate()` must produce `True` or `False`
//   anything else      no sample is attempted
//
// A signature can be an intersection of overloads (`Take`'s string arm vs. its collection
// arm, joined with `&`) or a union of them (`Rational`'s two constructors, joined with
// `|`) — every arm is tried, and the head counts as answering if ANY arm both has a
// derivable sample and produces one.
//
// Only CONCRETE parameter types get a sample (`integer`, `complex`, `list<…>`, …) — `any`
// and `value` are deliberately left undecided, because a function generic enough to take
// either a number or a collection (`Length`, `GCD`, …) is exactly where a blind numeric
// guess produces a false failure. A wrong guess would misreport a working head as broken,
// which is worse than not checking. No kernel needed, so this is a fast guard rather than
// an oracle sweep.
//
// Before any of that, an exact probe: the head's first reference example (its `expected`
// is already pinned by the reference tests), else a hand-written call from `PROBES` for the
// engine-native heads no reference page documents. A probe is checked by value, so it
// settles a head the signature leaves undecided.
//
//   vp node packages/census/scripts/audit-head-map.ts

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { DOMAINS } from "@enumeratio/domains";
import { GRAPHICS_HEADS } from "@enumeratio/formats";
import { CONTROL_SYMBOLS, LAYOUT_SYMBOLS, VISUAL_SYMBOLS } from "@enumeratio/notatio/symbols";
import { entries as referenceEntries } from "@enumeratio/reference";
import { HEADS } from "@enumeratio/wolfram/src";
import { fullEngine } from "../src/engine.ts";

type MathJSON = unknown;
const L = (...xs: MathJSON[]): MathJSON => ["List", ...xs];
const S = (...xs: MathJSON[]): MathJSON => ["Set", ...xs];

/** Exact checks for mapped heads with no reference example: `call` must evaluate to
 *  `expected`. A lazy collection answers through `Count`, so it is probed that way. */
const PROBES: Readonly<Record<string, { call: MathJSON; expected: MathJSON }>> = {
  Add: { call: ["Add", 2, 3], expected: 5 },
  Append: { call: ["Append", L(1, 2), 3], expected: L(1, 2, 3) },
  At: { call: ["At", L(5, 6, 7), 2], expected: 6 },
  Chop: { call: ["Chop", 1e-20], expected: 0 },
  Compose: { call: ["Apply", ["Compose", "Sqrt", "Sqrt"], 16], expected: 2 },
  Count: { call: ["Count", L(1, 2, 3)], expected: 3 },
  CyclicGroup: { call: ["GroupOrder", ["CyclicGroup", 5]], expected: 5 },
  Determinant: { call: ["Determinant", L(L(1, 2), L(3, 4))], expected: -2 },
  DihedralGroup: { call: ["GroupOrder", ["DihedralGroup", 4]], expected: 8 },
  Dot: { call: ["Dot", L(1, 2), L(3, 4)], expected: 11 },
  Equal: { call: ["Equal", 2, 2], expected: "True" },
  Filter: {
    call: ["Count", ["Filter", L(1, 2, 3, 4), ["Function", ["Greater", "x", 2], "x"]]],
    expected: 2,
  },
  First: { call: ["First", L(5, 6)], expected: 5 },
  Flatten: { call: ["Flatten", L(L(1, 2), L(3))], expected: L(1, 2, 3) },
  Function: { call: ["Apply", ["Function", ["Add", "x", 1], "x"], 2], expected: 3 },
  GCD: { call: ["GCD", 12, 18], expected: 6 },
  Greater: { call: ["Greater", 3, 2], expected: "True" },
  GreaterEqual: { call: ["GreaterEqual", 2, 2], expected: "True" },
  GroupElements: { call: ["Count", ["GroupElements", ["CyclicGroup", 3]]], expected: 3 },
  GrassmannAlgebra: { call: ["AlgebraDimension", ["GrassmannAlgebra", 3]], expected: 8 },
  GroupOrder: { call: ["GroupOrder", ["DihedralGroup", 4]], expected: 8 },
  IntegerString: { call: ["IntegerString", 255, 16], expected: "'ff'" },
  Intersection: { call: ["Intersection", S(1, 2, 3), S(2, 3, 4)], expected: S(2, 3) },
  Last: { call: ["Last", L(5, 6)], expected: 6 },
  LCM: { call: ["LCM", 4, 6], expected: 12 },
  Length: { call: ["Length", L(1, 2, 3)], expected: 3 },
  Less: { call: ["Less", 2, 3], expected: "True" },
  LessEqual: { call: ["LessEqual", 2, 2], expected: "True" },
  List: { call: ["List", 1, 2], expected: L(1, 2) },
  Max: { call: ["Max", 1, 5, 3], expected: 5 },
  Median: { call: ["Median", L(1, 3, 2)], expected: 2 },
  Min: { call: ["Min", 1, 5, 3], expected: 1 },
  // λ(i) = 1/2.
  ModularLambda: { call: ["N", ["ModularLambda", "ImaginaryUnit"]], expected: 0.5 },
  N: { call: ["N", ["Rational", 1, 4]], expected: 0.25 },
  NotEqual: { call: ["NotEqual", 2, 3], expected: "True" },
  OverBar: { call: ["OverBar", ["Add", 1, "i_1"]], expected: ["Add", ["Negate", "i_1"], 1] },
  Partition: { call: ["Partition", L(1, 2, 3, 4), 2], expected: L(L(1, 2), L(3, 4)) },
  Prepend: { call: ["Prepend", L(2, 3), 1], expected: L(1, 2, 3) },
  Product: { call: ["Product", "k", ["Tuple", "k", 1, 4]], expected: 24 },
  Random: { call: ["Element", ["Random", L(1, 2, 3)], L(1, 2, 3)], expected: "True" },
  Repeat: { call: ["Repeat", 0, 3], expected: L(0, 0, 0) },
  SetMinus: { call: ["SetMinus", S(1, 2, 3), 2], expected: S(1, 3) },
  Shape: { call: ["Shape", L(L(1, 2), L(3, 4))], expected: ["Tuple", 2, 2] },
  // The sample standard deviation, as Wolfram's: 4√14/7.
  StandardDeviation: {
    call: ["StandardDeviation", L(2, 4, 4, 4, 5, 5, 7, 9)],
    expected: ["Multiply", ["Rational", 4, 7], ["Sqrt", 14]],
  },
  Sum: { call: ["Sum", "k", ["Tuple", "k", 1, 4]], expected: 10 },
  Tuple: { call: ["Tuple", 1, 2], expected: ["Tuple", 1, 2] },
  Union: { call: ["Union", S(1, 2), S(2, 3)], expected: S(1, 2, 3) },
  // In 2D PGA, two lines through e_2 meet there.
  Vee: {
    call: [
      "Vee",
      ["Multiply", "e_1", "e_2"],
      ["Multiply", "e_2", "theta_1"],
      ["CliffordAlgebra", 2, 0, 1],
    ],
    expected: "e_2",
  },
  Variance: { call: ["Variance", L(1, 2, 3, 4)], expected: ["Rational", 5, 3] },
};

/** Heads held by design: drawn for display (plots, controls, layout, graphics primitives,
 *  `Rasterize`) or carrier constructors (`PermutationCycles`), which wrap a value rather than
 *  compute one. */
const HELD_HEADS = new Set([
  ...[...VISUAL_SYMBOLS, ...CONTROL_SYMBOLS, ...LAYOUT_SYMBOLS].map((symbol) => symbol.head),
  ...GRAPHICS_HEADS,
  "Rasterize",
  ...DOMAINS.map((domain) => domain.name),
]);

const mentions = (node: unknown, head: string): boolean =>
  node === head || (Array.isArray(node) && node.some((child) => mentions(child, head)));

/** The first plain reference example that uses `head`, from its own entry if it has one. */
function referenceProbe(head: string): { call: MathJSON; expected: MathJSON } | undefined {
  const own = referenceEntries.filter((entry) => entry.name === head);
  for (const entry of [...own, ...referenceEntries]) {
    const example = entry.examples.find(
      (e) => !e.aspirational && e.volatile === undefined && mentions(e.expr, head),
    );
    if (example) return { call: example.expr, expected: example.expected };
  }
  return undefined;
}

/** Split `s` on every top-level occurrence of a character in `on` — depth tracked by
 *  parens, so a separator nested inside a parenthesized union (or, for `sampleArgs`, a
 *  parameter list) does not count. */
function splitTopLevel(s: string, on: Set<string>): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && on.has(c)) {
      parts.push(s.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.slice(start).trim());
  return parts.filter((p) => p.length > 0);
}

/** Strip one fully-enclosing pair of parens, if `s` has one (`((a) -> b)` → `(a) -> b`). */
function unwrap(s: string): string {
  if (s[0] !== "(" || s[s.length - 1] !== ")") return s;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      // The opening paren at index 0 closes before the string ends — not a full wrap.
      if (depth === 0 && i < s.length - 1) return s;
    }
  }
  return s.slice(1, -1);
}

interface Arm {
  readonly params: string[];
  readonly returnType: string;
}

/** A signature's overload arms — one for a plain `(params) -> ret` signature, several for
 *  an intersection (`&`) or union (`|`) of them. */
function arms(signature: string): Arm[] {
  return splitTopLevel(signature, new Set(["&", "|"]))
    .map(unwrap)
    .map((arm): Arm | undefined => {
      const m = /^\((.*)\)\s*->\s*(.+)$/.exec(arm);
      if (!m) return undefined;
      return { params: splitTopLevel(m[1], new Set([","])), returnType: m[2].trim() };
    })
    .filter((a): a is Arm => a !== undefined);
}

/** Small distinct integers, DESCENDING by position: several multi-integer heads put a
 *  size-like value first and an index into it after (`DirichletCharacter(modulus, index,
 *  n)`, `DigitCount(n, base, digit)`) — an ascending sequence hands the "index" slot a
 *  bigger value than the "size" slot it has to stay under, which reads as broken for a
 *  head that works fine on an in-range argument. Also sidesteps `MultiplicativeOrder(3,
 *  3)` — gcd 3, not coprime — the same way: same distinctness, opposite order. */
function prime(i: number): number {
  const primes = [13, 11, 7, 5, 3, 2];
  return primes[i % primes.length];
}

/** Small fractions for non-integer numeric slots: several of these heads are only defined
 *  on a bounded interval (`ErfInv` on `(-1, 1)`, a regularized `Beta`/`Gamma` argument on
 *  `[0, 1]`) and a bare prime falls outside it, which used to read as "broken" for a head
 *  that works fine on the domain it actually promises. */
const FRACTIONS = [
  ["Rational", 1, 2],
  ["Rational", 1, 3],
  ["Rational", 2, 5],
  ["Rational", 1, 7],
];

/** A generic numeric slot (`complex`/`number`/`real`/`rational` — not `integer`, which
 *  always gets a prime) is tried under both schemes: some heads want an integer-shaped
 *  value (`Stirling`, `Factorial2`) and others a domain-bounded fraction (`ErfInv`,
 *  `BetaRegularized`). Neither guess is more "correct" than the other, so both are tried
 *  and the head only counts as broken if it answers neither. */
type NumericScheme = "prime" | "fraction";

/** One sample value for a parameter type string at position `i`, or `undefined` when the
 *  type is too generic (`any`, `value`) to guess at without misrepresenting the head. */
function sampleFor(param: string, i: number, scheme: NumericScheme): unknown {
  const t = param
    .replace(/^\w+:\s*/, "")
    .replace(/[?*+]+$/, "")
    .trim();
  // A callback parameter (`Sort`'s comparator, `Ordering`'s key function): its own `->`
  // arrow reads as a bare "number"/"boolean" return type to the regexes below, which would
  // hand it a plain integer as if it were the value itself.
  if (t.includes("->")) return undefined;
  if (/\binteger\b/.test(t)) return prime(i);
  if (/\b(complex|number|real|rational|finite_number)\b/.test(t)) {
    return scheme === "prime" ? prime(i) : FRACTIONS[i % FRACTIONS.length];
  }
  if (/\b(list|indexed_collection|collection|tuple|set)\b/.test(t)) return ["List", 1, 2, 3];
  if (/\bstring\b/.test(t)) return "abc";
  if (/\bboolean\b/.test(t)) return true;
  return undefined;
}

/** A representative argument tuple for one arm under one numeric scheme, or `undefined`
 *  when a REQUIRED parameter's type gives no usable clue. An optional (`?`) parameter with
 *  no derivable sample is dropped rather than aborting the whole arm. A variadic (`*`)
 *  trailing parameter gets two samples, `+` gets one (its minimum). */
function sampleArgs(params: string[], scheme: NumericScheme): unknown[] | undefined {
  const args: unknown[] = [];
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const sample = sampleFor(param, i, scheme);
    if (sample === undefined) {
      if (param.endsWith("?")) continue;
      return undefined;
    }
    args.push(sample);
    if (param.endsWith("*")) args.push(sample);
  }
  return args;
}

type ReturnKind = "numeric" | "collection" | "boolean";

/** Every kind of check a return type supports. Usually one — but a union return
 *  (`DigitCount`'s `integer | list<integer>`: a scalar count with a digit given, a list of
 *  per-digit counts without one) genuinely answers differently depending on the arguments,
 *  so both checks are offered and either satisfies it. */
function returnKinds(returnType: string): ReturnKind[] {
  const kinds: ReturnKind[] = [];
  if (/\b(list|set|tuple|indexed_collection|collection)\b/.test(returnType))
    kinds.push("collection");
  if (/\bboolean\b/.test(returnType)) kinds.push("boolean");
  if (/\b(number|integer|complex|real|rational|finite_number)\b/.test(returnType))
    kinds.push("numeric");
  return kinds;
}

/** `true` when the sample produced a real answer of the expected kind.
 *
 *  `BoxedExpression` is an alias for compute-engine's `Expression` union, and `.symbol`
 *  lives only on its narrowed symbol member — same story as `@enumeratio/boxed`'s
 *  `symbolNameOf`, not reused here to avoid a new cross-package dependency for one line. */
function producedAnswer(
  ce: ComputeEngine,
  head: string,
  args: unknown[],
  kind: ReturnKind,
): boolean {
  const boxed = ce.box([head, ...args] as never);
  switch (kind) {
    case "numeric": {
      const n = boxed.N();
      // `.re` is a base member of the union (finite for any real or complex numeric
      // result), unlike `.isNumberLiteral`, which only the narrowed literal member has.
      return Number.isFinite(n.re);
    }
    case "boolean": {
      const sym = (boxed.evaluate() as { symbol?: unknown }).symbol;
      return sym === "True" || sym === "False";
    }
    case "collection": {
      // `.count` only answers for a MATERIALIZED collection — a lazy source, and the
      // freshly-boxed, not-yet-evaluated call alike, both read as `undefined`.
      const count = boxed.evaluate().count;
      return typeof count === "number" && Number.isFinite(count);
    }
  }
}

type Category = "undeclared" | "unevaluated";

export interface AuditEntry {
  readonly head: string;
  readonly category: Category;
  /** The sample call an arm was tried with, e.g. `HarmonicNumber(3)` — omitted when no
   *  arm had a derivable sample (unverified, not cleared, not a claim the head is broken). */
  readonly sample?: string;
  readonly reason: string;
}

export function auditHeadMap(): AuditEntry[] {
  const ce = fullEngine();
  const entries: AuditEntry[] = [];

  for (const head of Object.keys(HEADS).sort()) {
    const def = ce.lookupDefinition(head);
    const op = def && "operator" in def ? def.operator : undefined;

    if (!def) {
      entries.push({ head, category: "undeclared", reason: "ce.lookupDefinition finds nothing" });
      continue;
    }
    if (HELD_HEADS.has(head)) continue;
    // A constant is emitted as a bare symbol, so it answers through N.
    const value = "value" in def ? (def.value as { isConstant?: boolean } | undefined) : undefined;
    if (!op && value?.isConstant) {
      if (!Number.isFinite(ce.box(head).N().re)) {
        entries.push({
          head,
          category: "unevaluated",
          sample: head,
          reason: "N gives no finite value",
        });
      }
      continue;
    }
    if (!op) {
      entries.push({
        head,
        category: "undeclared",
        reason: "declared as a value, not an operator — the transpiler emits it as a call",
      });
      continue;
    }

    const probe = referenceProbe(head) ?? PROBES[head];
    if (probe) {
      const sample = JSON.stringify(probe.call);
      try {
        const got = ce.box(probe.call as never).evaluate().json;
        if (JSON.stringify(got) !== JSON.stringify(probe.expected)) {
          entries.push({
            head,
            category: "unevaluated",
            sample,
            reason: `expected ${JSON.stringify(probe.expected)}, got ${JSON.stringify(got)}`,
          });
        }
      } catch (err) {
        entries.push({
          head,
          category: "unevaluated",
          sample,
          reason: `threw: ${(err as Error).message}`,
        });
      }
      continue;
    }

    const signature = op.signature?.toString() ?? "";
    const candidates = arms(signature)
      .flatMap((arm) =>
        returnKinds(arm.returnType).flatMap((kind) =>
          (["prime", "fraction"] as const)
            .map((scheme) => ({ arm, kind, args: sampleArgs(arm.params, scheme) }))
            .filter((c) => c.args !== undefined),
        ),
      )
      // Two schemes (or two return kinds) can agree exactly on the same call — don't try it
      // twice.
      .filter(
        (c, i, all) =>
          i ===
          all.findIndex(
            (o) => o.kind === c.kind && JSON.stringify(o.args) === JSON.stringify(c.args),
          ),
      ) as { arm: Arm; kind: ReturnKind; args: unknown[] }[];

    if (candidates.length === 0) {
      entries.push({
        head,
        category: "unevaluated",
        reason: `signature "${signature}" gives no arm with a derivable sample — unverified, not cleared`,
      });
      continue;
    }

    let passed = false;
    let firstSample = "";
    let firstReason = "";
    for (const { kind, args } of candidates) {
      const sample = `${head}(${args.map((a) => JSON.stringify(a)).join(", ")})`;
      try {
        if (producedAnswer(ce, head, args, kind)) {
          passed = true;
          break;
        }
        if (firstSample === "") {
          firstSample = sample;
          firstReason = `produced no ${kind} answer`;
        }
      } catch (err) {
        if (firstSample === "") {
          firstSample = sample;
          firstReason = `threw: ${(err as Error).message}`;
        }
      }
    }

    if (!passed) {
      entries.push({ head, category: "unevaluated", sample: firstSample, reason: firstReason });
    }
  }

  return entries;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const entries = auditHeadMap();
  const source = `// GENERATED by scripts/audit-head-map.ts — do not edit by hand.
//
// The warning in design/roadmap.md §1 generalized: every head in the wolfram head map
// (packages/wolfram/src/to-wolfram.ts \`HEADS\`) that the transpiler will happily emit, but
// that the engine either does not declare at all (\`undeclared\`) or does not actually
// produce an answer for a representative sample on any of its overload arms
// (\`unevaluated\`). Regenerate with:
//
//   vp node packages/census/scripts/audit-head-map.ts
//
// An \`unevaluated\` entry with no \`sample\` means no arm of the signature gave anything
// concrete to check — unverified, not cleared, so its absence from this list is not a claim
// the head works. Only \`undeclared\` is guarded by a test (tests/head-map-audit.test.ts);
// \`unevaluated\` is read-only for now — a passing sample is not proof a head is right for
// every shape it takes, and a failing one deserves a human look before it blocks anything.

export type AuditCategory = "undeclared" | "unevaluated";

export interface AuditEntry {
  readonly head: string;
  readonly category: AuditCategory;
  readonly sample?: string;
  readonly reason: string;
}

export const HEAD_MAP_AUDIT: readonly AuditEntry[] = ${JSON.stringify(entries, null, 2)};
`;
  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL("../src/head-map-audit-data.ts", import.meta.url), source);
  const undeclared = entries.filter((e) => e.category === "undeclared").length;
  const unevaluated = entries.filter((e) => e.category === "unevaluated").length;
  const verified = entries.filter((e) => e.category === "unevaluated" && e.sample).length;
  process.stdout.write(
    `head-map-audit-data.ts — ${Object.keys(HEADS).length} heads checked; ` +
      `${undeclared} undeclared, ${unevaluated} unevaluated (${verified} with a failing sample)\n`,
  );
}
