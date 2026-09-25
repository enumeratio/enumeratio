// Structural checks on the generated Python-family harnesses (design/benchmarking.md §4):
// no kernel needed, just the emitted text. `generated.test.ts` checks the committed files
// match a fresh generation; these check what a fresh generation should contain.

import { describe, expect, test } from "vite-plus/test";
import { catalogPlan, planned } from "../src/generate.ts";
import {
  CACHES_MPMATH,
  CACHES_SAGE,
  CACHES_SYMPY,
  generateMpmath,
  generateSage,
  generateSympy,
  harnessMpmath,
  harnessSage,
  harnessSympy,
} from "../src/generators/python.ts";
import { PROTOCOL } from "../src/protocol.ts";
import type { BenchSystem } from "../src/types.ts";

const plan = catalogPlan();

const SYSTEMS = [
  {
    system: "mpmath" as const,
    generate: generateMpmath,
    harness: harnessMpmath,
    caches: CACHES_MPMATH,
    file: "bench.py",
  },
  {
    system: "sympy" as const,
    generate: generateSympy,
    harness: harnessSympy,
    caches: CACHES_SYMPY,
    file: "bench.py",
  },
  {
    system: "sage" as const,
    generate: generateSage,
    harness: harnessSage,
    caches: CACHES_SAGE,
    file: "bench.sage.py",
  },
];

describe.each(SYSTEMS)("$system generator", ({ system, generate, harness, caches, file }) => {
  const files = generate(plan);
  const text = files[file] as string;

  test("emits exactly the one committed file", () => {
    expect(Object.keys(files)).toEqual([file]);
    expect(text.length).toBeGreaterThan(0);
  });

  test("every case planned for this system is present", () => {
    for (const { name } of planned(plan, system as BenchSystem)) {
      expect(text.includes(JSON.stringify(name)), name).toBe(true);
    }
  });

  test("the PROTOCOL numbers are embedded, not hard-coded", () => {
    // tooFastNs is a coordinator-side classification, not something the harness reads.
    for (const [key, value] of Object.entries(PROTOCOL)) {
      if (key === "version" || key === "tooFastNs") continue;
      expect(text.includes(String(value)), key).toBe(true);
    }
    expect(text).toContain('PROTOCOL["minSampleMs"]');
    expect(text).toContain('PROTOCOL["warmup"]');
    expect(text).toContain('PROTOCOL["samples"]');
    expect(text).toContain('PROTOCOL["minSamples"]');
    expect(text).toContain('PROTOCOL["batchBelowMs"]');
  });

  test("caches constant matches what the file actually does", () => {
    if (caches === "cleared") expect(text).toContain("clear_cache()");
    else expect(text).not.toContain("clear_cache()");
  });

  test("each source is a zero-argument callable, defined once, outside the timed loop", () => {
    // The timed region only ever calls `f()` through the case's `fns` list — never a source
    // literal, `eval`, or `sage_eval` inside `_measure`'s `time_k`.
    const timedRegion = text.slice(text.indexOf("def _measure"), text.indexOf("def run("));
    expect(timedRegion).not.toMatch(/sage_eval|json\.loads|import /);
    for (const { name, sources } of planned(plan, system as BenchSystem)) {
      const i = planned(plan, system as BenchSystem).findIndex((c) => c.name === name);
      for (const j of sources.keys()) expect(text).toContain(`_b${i}_${j}`);
    }
  });

  test("harness command points at the committed file", () => {
    const command = harness();
    expect(command.args.at(-1)).toContain(`generated/${system}/${file}`);
  });
});

describe("sage preparses once at startup, not per source", () => {
  const text = generateSage(plan)["bench.sage.py"] as string;
  test("sage_eval runs in a startup loop, once per source", () => {
    expect(text).toContain("_sage_sources = [");
    expect(text).toContain('globals()[_name] = sage_eval("lambda: (" + _src + ")"');
    // Exactly one loop building the callables, not one call per case.
    expect(text.match(/sage_eval\(/g)?.length).toBe(1);
  });
});
