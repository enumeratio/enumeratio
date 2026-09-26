// Pin the answers the YAML leaves out (sampled cases) into catalogue/pinned.json, computed by a
// local Wolfram kernel well past the case's precision: an exact answer as it is, a numeric one
// to ten digits more than the gate reads (twenty for machine). A pin records the formula it was
// made for, so changing a case's draw or size leaves it stale until this runs again.
//
//   node packages/bench/scripts/pin.ts            # pin what is missing or stale
//   node packages/bench/scripts/pin.ts --all      # re-pin everything

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { emit, type MathJSON } from "@enumeratio/oracle/src";
import { concretise, loadCatalogue, loadPins, PINS_FILE, type Pins } from "../src/catalogue.ts";
import { numeric } from "../src/generators/wolfram.ts";
import { formulaOf } from "../src/plan.ts";

const { values } = parseArgs({ options: { all: { type: "boolean", default: false } } });

const pins: Record<string, Pins[string]> = { ...loadPins() };
const todo = loadCatalogue()
  .map(concretise)
  .filter((c) => c.case.expected === undefined)
  .filter((c) => values.all || pins[c.name]?.formula !== formulaOf(c));

/**
 * Every non-integer double as the exact binary rational it is. Wolfram reads a decimal literal
 * by its digits, every other system by its binary value, and on the critical line near
 * t = 10^5 that difference alone moves ζ past a machine-precision gate.
 */
function exactDoubles(expr: MathJSON): MathJSON {
  if (typeof expr === "number" && Number.isFinite(expr) && !Number.isInteger(expr)) {
    let scaled = expr;
    let denominator = 1n;
    while (!Number.isInteger(scaled)) {
      scaled *= 2;
      denominator *= 2n;
    }
    return ["Rational", { num: BigInt(scaled).toString() }, { num: denominator.toString() }];
  }
  return Array.isArray(expr) ? expr.map((part: MathJSON) => exactDoubles(part)) : expr;
}

const str = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
const lines: string[] = [];
for (const c of todo) {
  const out = emit(exactDoubles(c.inputs[0]!), "wolfram");
  if (!out.ok) {
    console.error(`${c.name}: Wolfram has no mapping for ${out.missing.join(", ")}; not pinned`);
    continue;
  }
  const p = c.case.bench.precision;
  const source = numeric(out.source, p === "exact" ? "exact" : p === "machine" ? 20 : p + 10);
  lines.push(`Print["<<", ${str(c.name)}, ">>", ToString[TimeConstrained[${source}, 600, $Aborted], InputForm]];`);
}

if (lines.length > 0) {
  const dir = mkdtempSync(join(tmpdir(), "bench-pin-"));
  try {
    const file = join(dir, "pin.wl");
    // A huge exact argument (Sin of a 1000-bit integer) needs its digits and then some.
    writeFileSync(file, `$MaxExtraPrecision = 10000;\n${lines.join("\n")}\n`);
    const text = execFileSync("wolframscript", ["-file", file], { encoding: "utf8", maxBuffer: 64 << 20 });
    for (const match of text.matchAll(/^<<(.+?)>>(.*)$/gm)) {
      const [, name, raw] = match as unknown as [string, string, string];
      const c = todo.find((t) => t.name === name)!;
      // Precision marks (`30.`) are the kernel's bookkeeping, not digits.
      const answer = raw.replace(/`[\d.]*/g, "");
      // An accuracy-only zero (`0``20.`) means the kernel ran out of precision.
      if (/\$Aborted|\$Failed|Indeterminate|``/.test(raw) || answer.includes("[")) {
        console.error(`${name}: Wolfram answered ${answer}; not pinned`);
        continue;
      }
      pins[name] = { formula: formulaOf(c), answer };
      console.log(`pinned ${name}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Drop pins for cases that have left the catalogue or been given a written answer.
const live = new Set(
  loadCatalogue()
    .filter((c) => c.expected === undefined)
    .map((c) => `${c.head}/${c.id}`),
);
const sorted = Object.fromEntries(
  Object.entries(pins)
    .filter(([name]) => live.has(name))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
);
writeFileSync(PINS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
