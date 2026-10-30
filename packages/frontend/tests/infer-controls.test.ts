import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ComputeEngine } from "@cortex-js/compute-engine";
import { parseExpression } from "@enumeratio/formats/expression";
import { afterAll, expect, test } from "vite-plus/test";
import { freeSymbols, inferControls, type InferContext, paramsOf } from "../src/infer-controls.ts";
import { parseControls } from "../src/manipulate.ts";

// What each expression's free symbols get as controls: golden JSON compared with
// `toEqual` (AGENTS.md), regenerated with `UPDATE_INFER_CONTROLS=1 vp test` after an
// intended change.
const ce = new ComputeEngine();
ce.declare("copies", "integer");
ce.assume(ce.box(["Greater", "copies", 0]));
ce.declare("depth", "integer");
ce.assume(ce.box(["GreaterEqual", "depth", 0]));
ce.declare("deficit", "integer");
ce.assume(ce.box(["LessEqual", "deficit", 0]));
ce.declare("offset", "integer");
ce.declare("on", "boolean");
ce.declare("label", "string");
ce.declare("w", "complex");
ce.declare("height", "real");
ce.assume(ce.box(["Greater", "height", 0]));
ce.declare("gain", "real");

const SIX = "'a' | 'b' | 'c' | 'd' | 'e' | 'f'";

const CASES: Record<string, { src: string; ctx?: InferContext }> = {
  "free symbol is a real": { src: "a * Sin(b)" },
  "bound variable of a plot is skipped": { src: "Plot(Sin(a * x), (x, 0, 10))" },
  "bound variable of a sum is skipped": { src: "Sum(k^m, (k, 1, 10))" },
  "typed integer": { src: "offset + 1", ctx: { engine: ce } },
  "positive integer clamps at 1": { src: "copies", ctx: { engine: ce } },
  "non-negative integer clamps at 0": { src: "depth", ctx: { engine: ce } },
  "non-positive integer clamps at 0 from above": { src: "deficit", ctx: { engine: ce } },
  "positive real stays off zero": { src: "height", ctx: { engine: ce } },
  "declared real": { src: "gain", ctx: { engine: ce } },
  boolean: { src: "on", ctx: { engine: ce } },
  string: { src: "label", ctx: { engine: ce } },
  complex: { src: "w", ctx: { engine: ce } },
  "enum of five or fewer is a setter bar": { src: "c", ctx: { types: { c: "'a' | 'b' | 'c'" } } },
  "enum of more than five is a popup menu": { src: "c", ctx: { types: { c: SIX } } },
  "numeric enum": { src: "c", ctx: { types: { c: "2 | 3 | 5 | 7" } } },
  "several symbols, in order of appearance": { src: "b + a * copies", ctx: { engine: ce } },
  "bound names are skipped": { src: "a + b", ctx: { bound: new Set(["a"]) } },
  "names restrict the symbols": { src: "a + b", ctx: { names: ["b"] } },
  "hint range overrides the inferred one": { src: "a", ctx: { hints: { a: { min: 0, max: 5, step: 0.5, start: 2 } } } },
  "hint type overrides the engine": { src: "gain", ctx: { engine: ce, hints: { gain: { type: "integer" } } } },
  "hint choices": { src: "k", ctx: { hints: { k: { choices: [2, 3, 5, 7], start: 5 } } } },
  "control type, compatible": { src: "a", ctx: { hints: { a: { controlType: "Knob" } } } },
  "control type, incompatible with the domain": {
    src: "on",
    ctx: { engine: ce, hints: { on: { controlType: "Slider" } } },
  },
  "control type on a menu": {
    src: "c",
    ctx: { types: { c: "'a' | 'b'" }, hints: { c: { controlType: "PopupMenu" } } },
  },
  "letter conventions off": { src: "n + z" },
  "letter conventions on": { src: "n + z + a", ctx: { letterConventions: true } },
  "the engine beats a letter": { src: "offset", ctx: { engine: ce, letterConventions: true } },
  "a hint beats a letter": { src: "n", ctx: { letterConventions: true, hints: { n: { min: 0, max: 1 } } } },
};

const GOLDEN = fileURLToPath(new URL("./infer-controls.golden.json", import.meta.url));
const updating = process.env.UPDATE_INFER_CONTROLS === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

for (const [id, { src, ctx }] of Object.entries(CASES)) {
  test(`infers: ${id}`, () => {
    const { json, errors } = parseExpression(src);
    expect(errors).toEqual([]);
    const specs = inferControls(json, ctx);
    fresh[id] = specs;
    // Nothing a golden cannot hold: no functions, no NaN.
    expect(JSON.parse(JSON.stringify(specs))).toEqual(specs);
    if (!updating) expect(specs).toEqual(golden[id]);
  });
}

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

test("free symbols leave out constants, wildcards and heads", () => {
  expect(freeSymbols(parseExpression("Sin(a) + Pi * i + _s").json)).toEqual(["a"]);
});

test("every spec reads back as a control of the same kind", () => {
  const kinds = {
    integers: "slider",
    reals: "slider",
    choices: "choice",
    booleans: "toggle",
    points: "point",
    any: "text",
  } as const;
  for (const [id, { src, ctx }] of Object.entries(CASES)) {
    for (const spec of inferControls(parseExpression(src).json, ctx)) {
      const params = paramsOf(spec);
      // Manipulate's choice control is numeric: a list of strings has no tuple yet.
      if (spec.domain.kind === "choices" && spec.domain.values.some((v) => typeof v !== "number")) {
        expect(params, id).toBeUndefined();
        continue;
      }
      expect(params, id).toBeDefined();
      const [control] = parseControls(params as string);
      expect(control?.kind, id).toBe(kinds[spec.domain.kind as keyof typeof kinds]);
      expect(control?.name, id).toBe(spec.name);
    }
  }
});
