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

beforeAll(async () => {
  await import("../src/notatio-manipulate.ts");
  await import("../src/template-slot.ts");
  await import("../src/dynamic-module-box.ts");
  const engine = await loadEngine();
  engine.declare("count", "integer");
  engine.declare("flag", "boolean");
});

afterAll(() => {
  if (updating) writeFileSync(GOLDEN, `${JSON.stringify(fresh, null, 2)}\n`);
});

/** Wait until `done()` holds; the elements fill in as the engine and the controls load. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !done(); i++) await new Promise((r) => setTimeout(r, 25));
  expect(done()).toBe(true);
}

const CONTROL = "slider-box, checkbox-box, stepper-box, knob-box, toggler-box, setter-bar-box, popup-menu-box";

/** The controls under `root` as data: tag, name and the attributes that say how each is drawn. */
function drawn(root: Element): unknown[] {
  return [...root.querySelectorAll(CONTROL)].map((el) => ({
    tag: el.localName,
    name: el.getAttribute("name"),
    ...Object.fromEntries(
      ["min", "max", "step", "values"].flatMap((a) => (el.hasAttribute(a) ? [[a, el.getAttribute(a)]] : [])),
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
