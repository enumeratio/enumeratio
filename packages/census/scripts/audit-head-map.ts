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
//   vp node packages/census/scripts/audit-head-map.ts

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { HEADS } from "@enumeratio/wolfram/src";
import { fullEngine } from "../src/engine.ts";

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
    if (!op) {
      entries.push({
        head,
        category: "undeclared",
        reason: "declared as a value, not an operator — the transpiler emits it as a call",
      });
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
