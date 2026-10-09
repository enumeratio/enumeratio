import { ComputeEngine, version } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { expect, test } from "vite-plus/test";
import { CHECKED_COMPUTE_ENGINE, libraryOperator, shadowsLibrary } from "../src/ce-internals.ts";
import { extendHead } from "../src/index.ts";

// The compile stance reads two things from compute-engine's internals (ce-internals.ts). A bump of
// compute-engine fails here until someone has checked both still hold and moved CHECKED_COMPUTE_ENGINE on.

test("compute-engine is the version whose shadow rules ce-internals.ts was checked against", () => {
  expect(version).toBe(CHECKED_COMPUTE_ENGINE);
});

test("the library operator is the one a fresh engine's lookup resolves to, and an extension is not", () => {
  const ce = new ComputeEngine();
  const fresh = (ce.lookupDefinition("Sin") as { operator: object }).operator;
  expect(libraryOperator(ce, "Sin")).toBe(fresh);
  extendHead(ce, "Sin", { broadcastable: true });
  const extended = (ce.lookupDefinition("Sin") as { operator: object }).operator;
  expect(extended).not.toBe(fresh);
  expect(libraryOperator(ce, "Sin")).toBe(fresh);
  expect(libraryOperator(ce, "NotAHead")).toBeUndefined();
});

test("shadowsLibrary agrees with compute-engine's own refusal to compile a shadowed head", () => {
  const ce = new ComputeEngine();
  const operator = () => (ce.lookupDefinition("Sin") as { operator: { evaluate?: unknown } }).operator;
  expect(shadowsLibrary(ce, "Sin", operator())).toBe(false);
  extendHead(ce, "Sin", { broadcastable: true });
  operator().evaluate = () => undefined;
  expect(shadowsLibrary(ce, "Sin", operator())).toBe(true);
  expect(() => new JavaScriptTarget().compile(ce.box(["Sin", "x"]))).toThrow(/shadows the library operator/);
});
