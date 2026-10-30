// @vitest-environment happy-dom
// Generated controls, end to end through the elements: what a `<notatio-manipulate infer>` draws
// once the engine says a symbol is an integer or a boolean, what a `Variables -> Automatic` scope
// gives each hole of its prose, and that a notebook's scope is the one read. The drawn controls
// are golden data (`UPDATE_UI_INFERENCE=1 vp test` regenerates it).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inferControls, loadEngine, paramsOf } from "@enumeratio/frontend/core";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";

// (`import.meta.url` is not a file URL under the DOM environment.)
const GOLDEN = join(import.meta.dirname, "ui-inference.golden.json");
const updating = process.env.UPDATE_UI_INFERENCE === "1";
const golden: Record<string, unknown> = updating ? {} : JSON.parse(readFileSync(GOLDEN, "utf8"));
const fresh: Record<string, unknown> = {};

// Cold import of the element graph can outlast the 10 s hook default on a loaded CI runner.
beforeAll(async () => {
  await import("../src/notatio-manipulate.ts");
  await import("../src/template-slot.ts");
  await import("../src/dynamic-module-box.ts");
  const engine = await loadEngine();
  engine.declare("count", "integer");
  engine.declare("flag", "boolean");
}, 60_000);

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

/** Wait until `done()` holds; the elements fill in as the engine and the controls load. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 25));
  expect(done()).toBe(true);
}

const CONTROL =
  "slider-box, checkbox-box, stepper-box, knob-box, toggler-box, setter-bar-box, popup-menu-box, slider-2d-box";

/** The controls under `root` as data: tag, name and the attributes that say how each is drawn. */
function drawn(root: Element): unknown[] {
  return [...root.querySelectorAll(CONTROL)].map((el) => ({
    tag: el.localName,
    name: el.getAttribute("name"),
    ...Object.fromEntries(
      ["min", "max", "step", "values", "symbols"].flatMap((a) => (el.hasAttribute(a) ? [[a, el.getAttribute(a)]] : [])),
    ),
  }));
}

function check(id: string, actual: unknown): void {
  if (updating) fresh[id] = actual;
  else expect(actual).toEqual(golden[id]);
}

test("a Manipulate refines a bare name by the engine's declaration of it", async () => {
  // What the lowering writes for bare names, with no engine to ask: a real slider each.
  const params = inferControls(null, { names: ["count", "flag", "x"] })
    .flatMap((spec) => paramsOf(spec) ?? [])
    .join("; ");
  const el = document.createElement("notatio-manipulate");
  el.setAttribute("params", params);
  el.setAttribute("infer", "count,flag");
  document.body.append(el);
  await until(() => el.querySelector("checkbox-box") !== null);
  check("manipulate refines declared names", drawn(el));
  el.remove();
});

test("Variables -> Automatic gives each hole of the prose the control its type calls for", async () => {
  const scope = document.createElement("div");
  scope.setAttribute("variables", "Automatic");
  scope.innerHTML = ["count", "flag", "w"].map((n) => `<template-slot name="${n}"></template-slot>`).join(" ");
  document.body.append(scope);
  await until(() => scope.querySelector("stepper-box, knob-box, toggler-box") !== null && drawn(scope).length === 3);
  check("automatic variables", drawn(scope));
  scope.remove();
});

test("a symbol choice is a bar that binds the symbol", async () => {
  const el = document.createElement("notatio-manipulate");
  el.setAttribute("params", "{{o, Natural}, {Natural, ChineseRemainder, Adic}}");
  el.innerHTML = '<dynamic-box value="_o"></dynamic-box>';
  document.body.append(el);
  await until(() => el.querySelector("setter-bar-box") !== null);
  check("symbol choice", drawn(el));
  const bar = el.querySelector("setter-bar-box") as unknown as HTMLElement & {
    binding: unknown;
    choose(i: number): void;
  };
  bar.choose(2);
  expect(bar.binding).toBe("Adic");
  el.remove();
});

test("a variable of the prose that is complex gets a 2D pad, bound as a number", async () => {
  const scope = document.createElement("div");
  scope.setAttribute("variables", "Automatic");
  scope.innerHTML = '<template-slot name="z"></template-slot>';
  document.body.append(scope);
  await until(() => scope.querySelector("slider-2d-box") !== null);
  check("complex hole", drawn(scope));
  const pad = scope.querySelector("slider-2d-box") as HTMLElement & { binding: unknown };
  expect(pad.binding).toBe(1);
  scope.remove();
});

test("a knob over symbol choices binds the symbol", async () => {
  const scope = document.createElement("div");
  scope.setAttribute("variables", "[_o -> [Natural, ChineseRemainder, Adic]]");
  scope.innerHTML = '<template-slot name="o" knob></template-slot>';
  document.body.append(scope);
  await until(() => scope.querySelector("knob-box[symbols]") !== null);
  check("symbol knob", drawn(scope));
  const knob = scope.querySelector("knob-box") as unknown as HTMLElement & {
    binding: unknown;
    value: string;
    updateComplete: Promise<unknown>;
  };
  expect(knob.binding).toBe("Natural");
  knob.value = "Adic";
  await knob.updateComplete;
  expect(knob.binding).toBe("Adic");
  scope.remove();
});

test("a ring's lattice point is an integer pad that binds the point as a Tuple", async () => {
  const scope = document.createElement("div");
  scope.setAttribute(
    "variables",
    "[_g -> Variable(GaussianIntegers, (-1, 1)), _e -> Variable(EisensteinIntegers, (2, -1))]",
  );
  scope.innerHTML = '<template-slot name="g"></template-slot> <template-slot name="e"></template-slot>';
  document.body.append(scope);
  await until(() => scope.querySelectorAll("slider-2d-box").length === 2);
  check("lattice holes", drawn(scope));
  const [g, e] = [...scope.querySelectorAll("slider-2d-box")] as unknown as { binding: unknown }[];
  expect(g!.binding).toEqual(["Tuple", -1, 1]);
  expect(e!.binding).toEqual(["Tuple", 2, -1]);
  scope.remove();
});

test("inside a notebook's module, its scope's declarations are the ones read", async () => {
  const engine = await loadEngine();
  const module = document.createElement("dynamic-module-box") as HTMLElement & {
    transcriptFor(engine: unknown): { run<T>(fn: () => T): T };
  };
  document.body.append(module);
  module.transcriptFor(engine).run(() => engine.declare("depth", "integer"));
  const params = paramsOf(inferControls(null, { names: ["depth"] })[0]!)!;
  const inside = document.createElement("notatio-manipulate");
  inside.setAttribute("params", params);
  inside.setAttribute("infer", "depth");
  module.append(inside);
  await until(() => inside.querySelector("slider-box")?.getAttribute("step") === "1");
  check("module scope declarations", drawn(inside));
  // Outside the module the same name stays a real slider: the declaration is the scope's.
  const outside = document.createElement("notatio-manipulate");
  outside.setAttribute("params", params);
  outside.setAttribute("infer", "depth");
  document.body.append(outside);
  await until(() => outside.querySelector("slider-box") !== null);
  await new Promise((r) => setTimeout(r, 200));
  check("outside the module", drawn(outside));
  module.remove();
  outside.remove();
});

/** The plot a Manipulate shows, as the tag and attributes of its direct child that is not the control panel. */
const plotOf = (el: Element): unknown =>
  [...el.children]
    .filter((c) => c.hasAttribute("value"))
    .map((c) => ({
      tag: c.localName,
      ...Object.fromEntries([...c.attributes].map((a) => [a.name, a.value])),
    }));

test("an inferred plot is chosen again from the engine's declarations of its axis", async () => {
  const engine = await loadEngine();
  engine.declare("lattice", "integer");
  engine.declare("omega", "complex");
  const cases: Record<string, { body: string; axis: string }> = {
    "integer axis is points": { body: "_a * lattice ^ 2", axis: "lattice" },
    "complex axis is a portrait": { body: "omega ^ 2 + _a", axis: "omega" },
    "undeclared axis stays as lowered": { body: "_a * wander", axis: "wander" },
  };
  const drawnPlots: Record<string, unknown> = {};
  for (const [id, { body, axis }] of Object.entries(cases)) {
    const el = document.createElement("notatio-manipulate");
    el.setAttribute("params", "{{a, 1}, -10, 10, 0.05, Slider}");
    el.setAttribute("infer", "a");
    el.setAttribute("plot-of", body.replaceAll("_a", "a"));
    el.setAttribute("plot-axes", axis);
    el.innerHTML = `<graphics-box value="Plot(${body}, (${axis}, -5, 5))"></graphics-box>`;
    document.body.append(el);
    await until(() => el.querySelector("slider-box") !== null);
    await new Promise((r) => setTimeout(r, 200));
    drawnPlots[id] = plotOf(el);
    el.remove();
  }
  check("replotted by declaration", drawnPlots);
});

test("a Manipulate with no inferred plot is left as written", async () => {
  const engine = await loadEngine();
  engine.declare("stride", "integer");
  const el = document.createElement("notatio-manipulate");
  el.setAttribute("params", "{a, 1, 5}");
  el.innerHTML = '<graphics-box value="Plot(_a * stride, (stride, 0, 10))"></graphics-box>';
  document.body.append(el);
  await until(() => el.querySelector("slider-box") !== null);
  await new Promise((r) => setTimeout(r, 200));
  expect(plotOf(el)).toEqual([{ tag: "graphics-box", value: "Plot(_a * stride, (stride, 0, 10))" }]);
  el.remove();
});
