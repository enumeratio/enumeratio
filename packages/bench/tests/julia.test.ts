// Structural checks on the generated Julia-family harnesses (design/benchmarking.md §4): no
// kernel needed, just the emitted text. `generated.test.ts` checks the committed files match a
// fresh generation; these check what a fresh generation should contain.

import { describe, expect, test } from "vite-plus/test";
import { catalogPlan, planned } from "../src/generate.ts";
import {
  CACHES_JULIA,
  CACHES_OSCAR,
  generateJulia,
  generateOscar,
  harnessJulia,
  harnessOscar,
} from "../src/generators/julia.ts";
import { PROTOCOL } from "../src/protocol.ts";
import type { BenchSystem } from "../src/types.ts";

const plan = catalogPlan();

const SYSTEMS = [
  {
    system: "julia" as const,
    generate: generateJulia,
    harness: harnessJulia,
    caches: CACHES_JULIA,
  },
  {
    system: "oscar" as const,
    generate: generateOscar,
    harness: harnessOscar,
    caches: CACHES_OSCAR,
  },
];

describe.each(SYSTEMS)("$system generator", ({ system, generate, harness, caches }) => {
  const files = generate(plan);
  const text = files["harness.jl"] as string;
  const cases = planned(plan, system as BenchSystem);

  test("emits exactly the one committed file", () => {
    expect(Object.keys(files)).toEqual(["harness.jl"]);
    expect(text.length).toBeGreaterThan(0);
  });

  test("every case planned for this system is present, by name and by function", () => {
    for (const [n, { name, sources }] of cases.entries()) {
      expect(text.includes(JSON.stringify(name)), name).toBe(true);
      for (const j of sources.keys()) expect(text).toContain(`b_${n}_${j}()`);
    }
  });

  test("the PROTOCOL numbers are embedded, not hard-coded", () => {
    // version is a comparability marker, not a harness parameter; tooFastNs is a coordinator-
    // side classification the harness never reads.
    for (const [key, value] of Object.entries(PROTOCOL)) {
      if (key === "version" || key === "tooFastNs") continue;
      expect(text.includes(String(value)), key).toBe(true);
    }
    expect(text).toContain("_PROTO_WARMUP ");
    expect(text).toContain("_PROTO_WARMUP_MS ");
    expect(text).toContain("_PROTO_SAMPLES ");
    expect(text).toContain("_PROTO_MIN_SAMPLES ");
    expect(text).toContain("_PROTO_BATCH_BELOW_MS ");
    expect(text).toContain("_PROTO_MIN_SAMPLE_MS ");
  });

  test("caches: uncleared, and GC.gc() stands in for a clear", () => {
    expect(caches).toBe("uncleared");
    expect(text).toContain("GC.gc()");
  });

  test("every numeric literal in a source is hoisted to a Ref, read inside the function", () => {
    // A source with a digit in it (every case in the catalogue right now) must not appear
    // verbatim as a function body — it should show up rewritten with `_r<N>[]` instead.
    const withDigits = cases.filter(({ sources }) => sources.some((s) => /\d/.test(s)));
    expect(withDigits.length).toBeGreaterThan(0);
    for (const { sources } of withDigits) {
      for (const source of sources) expect(text).not.toContain(`() = ${source}\n`);
    }
    expect(text.match(/const _r\d+ = Ref\(/g)?.length ?? 0).toBeGreaterThan(0);
  });

  test("each source is defined once, outside the timed loop", () => {
    // The timed region (inside _measure) only ever calls `call()`, never a source literal,
    // Meta.parse, or an include.
    const timedRegion = text.slice(text.indexOf("function _measure"), text.indexOf("function _run"));
    expect(timedRegion).not.toMatch(/Meta\.parse|include\(|eval\(/);
  });

  test("harness command points at the committed file, under the right project", () => {
    const command = harness();
    expect(command.command).toBe("julia");
    expect(command.args.at(-1)).toContain(`generated/${system}/harness.jl`);
    expect(command.args.some((a) => a.startsWith("--project=") && a.endsWith(`/oracle/${system}`))).toBe(true);
  });
});

describe("oscar includes the shared group-algebra preamble relative to itself", () => {
  const text = generateOscar(plan)["harness.jl"] as string;
  test("include() is anchored at @__DIR__, not an absolute checkout path", () => {
    expect(text).toMatch(/include\(joinpath\(@__DIR__, "[^"]+preamble\.jl"\)\)/);
    expect(text).not.toContain('/packages/oracle/oscar/preamble.jl")');
  });
});

describe("julia has no group-algebra include (Nemo + Combinatorics only)", () => {
  const text = generateJulia(plan)["harness.jl"] as string;
  test("no include() at all", () => {
    expect(text).not.toContain("include(");
  });
});
