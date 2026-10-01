import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { aboutFields, applyPatch } from "../src/index.ts";

const ce = new ComputeEngine();
applyPatch(ce, aboutFields);

const about = (name: string): Record<string, unknown> =>
  (ce.box(["About", name]).evaluate().json as { dict: Record<string, unknown> }).dict;

test("a standard-library head reports its examples", () => {
  expect(about("Sin")).toMatchObject({
    name: "Sin",
    kind: "function",
    examples: ["Sin(Pi / 6)", "Sin(1)", "N(Sin(1))"],
  });
});

test("attributes are a list, lazy among them", () => {
  expect(about("Add").attributes).toEqual(["commutative", "associative", "idempotent", "lazy"]);
  expect(about("Hold").attributes).toEqual(["lazy"]);
  expect(about("Sin").attributes).toBeUndefined();
});

test("a declared definition's examples and keywords are kept", () => {
  ce.declare("Twice", {
    signature: "(number) -> number",
    description: "Twice its argument.",
    examples: "Twice(3)",
    keywords: ["double"],
    evaluate: ([x]) => x!.mul(2),
  });
  expect(about("Twice")).toEqual({
    name: "Twice",
    kind: "function",
    signature: "(number) -> number",
    description: "Twice its argument.",
    examples: ["Twice(3)"],
    keywords: ["double"],
  });
});

test("what isn't a declared name is reported as before", () => {
  expect(about("Fooble")).toEqual({ name: "Fooble", kind: "symbol", type: "unknown" });
  expect(ce.box(["About", "'Sin'"]).evaluate().json).toEqual({
    dict: { kind: "string", type: "string", value: "Sin" },
  });
});
