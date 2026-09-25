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
//   node packages/reference/scripts/oracle-quickcheck.ts mpmath sympy
//   node packages/reference/scripts/oracle-quickcheck.ts julia --seed 2026-09-25 --samples 4

import { appendFileSync, writeFileSync } from "node:fs";
import { runCases } from "@enumeratio/aestimatio/src/node";
import { emit, type MathJSON, runIn, type System, type Verdict } from "@enumeratio/oracle/src";
import { referenceEntries } from "../src/node.ts";
import { verdictOf } from "./oracle-verdict.ts";

const entries = referenceEntries();

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const systems = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--")) as System[];
const seed = option("seed") ?? new Date().toISOString().slice(0, 10);
const perTemplate = Number(option("samples") ?? 3);
const strict = args.includes("--strict");

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
const STRUCTURAL = new Set([
  "Diagram",
  "OrbitDiagram",
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
    .filter((example) => example.aspirational !== true && example.volatile === undefined)
    .filter((example) => systems.some((system) => emit(example.expr as MathJSON, system).ok))
    .map((example) => ({
      id: `${entry.name}/${example.id}`,
      expr: example.expr as MathJSON,
      others: (example.others ?? {}) as Template["others"],
    })),
);

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
const UNDEFINED = new Set(["ComplexInfinity", "PositiveInfinity", "NegativeInfinity", "NaN"]);
const POLE = /pole|infinit|ZeroDivision|division by zero|divide by zero|modulo by zero|undefined/i;
const RESOURCE = /TimeoutError|MemoryError|KernelDied|killed|\$Aborted/;
/** The other system refusing an argument outside its function's domain. */
const DOMAIN = /DomainError|non-?negative|must be positive|positive integer|not an integer|zero modulus|expected/i;

/** The kinds a sample earns without a person: both sides decline, in different words, or the
 * other system ran out of time or memory. Anything else is a finding. */
function autoKind(sample: MathJSON, ours: MathJSON, result: { value?: string; error?: string }): string | undefined {
  const theirs = result.error ?? result.value ?? "";
  if (result.error !== undefined && RESOURCE.test(theirs)) return "resource";
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
  if (oursDeclines && theirsDeclines) return "undefined-form";
  // They refuse the argument: a domain difference when ours answers, both declining when not.
  if (result.error !== undefined && DOMAIN.test(theirs)) return oursDeclines ? "undefined-form" : "domain";
  return undefined;
}

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
const lines: string[] = [
  `## Oracle quickcheck — seed \`${seed}\``,
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
  const sources = runnable.map((row) => (row.out as { source: string }).source);
  process.stderr.write(`${system}: ${sources.length} samples — running…\n`);
  const results = await runIn(system, sources);
  let agree = 0;
  let inherited = 0;
  let automatic = 0;
  let found = 0;
  const autos = new Map<string, number>();
  runnable.forEach((row, i) => {
    const result = results[i] as { value?: string; numeric?: string; error?: string };
    const expected = expectedOf.get(row.sample.id) as MathJSON;
    const verdict: Verdict | "error" = result.error !== undefined ? "error" : verdictOf(system, expected, result);
    if (verdict === "agree") return void agree++;
    const baseline = row.sample.template.others[system];
    // The same way the template already differs, and that is classified: nothing new.
    if (baseline !== undefined && baseline.verdict === verdict && baseline.kind !== undefined) {
      return void inherited++;
    }
    const auto = autoKind(row.sample.expr, expected, result);
    if (auto !== undefined) {
      autos.set(auto, (autos.get(auto) ?? 0) + 1);
      return void automatic++;
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
  });
  const autoText = [...autos].map(([kind, n]) => `${kind} ${n}`).join(", ") || "0";
  lines.push(`| ${system} | ${runnable.length} | ${agree} | ${inherited} | ${autoText} | ${found} |`);
  process.stderr.write(
    `${system}: agree ${agree}, inherited ${inherited}, automatic ${automatic}, findings ${found}\n`,
  );
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
  for (const [head, group] of [...byHead].sort((a, b) => b[1].length - a[1].length)) {
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
const summary = `${lines.join("\n")}\n`;
process.stdout.write(summary);
if (process.env["GITHUB_STEP_SUMMARY"]) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], summary);
writeFileSync(
  new URL("../golden/oracle/quickcheck.json", import.meta.url),
  `${JSON.stringify({ seed, systems, samples: samples.length, findings }, null, 2)}\n`,
);
if (strict && findings.length > 0) process.exitCode = 1;
