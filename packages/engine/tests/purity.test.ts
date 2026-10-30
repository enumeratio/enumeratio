import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { IMPURE_HEADS, installPurityDefault } from "../src/index.ts";

const pureOf = (ce: ComputeEngine, name: string): boolean | undefined =>
  (ce.lookupDefinition(name) as { operator?: { pure?: boolean } } | undefined)?.operator?.pure;

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  installPurityDefault(ce);
  return ce;
};

describe("installPurityDefault", () => {
  test("a head that states nothing is pure", () => {
    const ce = engine();
    ce.declare("Twice", { signature: "(number) -> number", evaluate: (ops) => ce.box(["Multiply", 2, ops[0]!.json]) });
    expect(pureOf(ce, "Twice")).toBe(true);
  });

  test("a head in IMPURE_HEADS is handed to compute-engine as written, never marked pure", () => {
    const ce = new ComputeEngine();
    const seen: Record<string, unknown>[] = [];
    const declare = ce.declare.bind(ce) as (...args: unknown[]) => ComputeEngine;
    (ce as { declare: unknown }).declare = (...args: unknown[]) => {
      seen.push(args[1] as Record<string, unknown>);
      return declare(...args);
    };
    installPurityDefault(ce);
    for (const name of IMPURE_HEADS) ce.declare(name, { signature: "(any*) -> any", lazy: true });
    expect(seen.length).toBe(IMPURE_HEADS.size);
    for (const def of seen) expect("pure" in def).toBe(false);
  });

  test("stated purity and effect-bearing signatures are left alone", () => {
    const ce = engine();
    ce.declare("Stated", { signature: "(number) -> number", pure: true, evaluate: () => ce.number(1) });
    ce.declare("Draws", { signature: "(number) random -> number", evaluate: () => ce.number(1) });
    expect(pureOf(ce, "Stated")).toBe(true);
    expect(pureOf(ce, "Draws")).toBe(false);
  });

  test("values and the record form", () => {
    const ce = engine();
    ce.declare("Xv", { type: "integer", value: 3 });
    ce.declare({ Yo: { signature: "(number) -> number", evaluate: () => ce.number(1) }, Zv: "integer" });
    expect(ce.box("Xv").evaluate().json).toBe(3);
    expect(pureOf(ce, "Yo")).toBe(true);
  });

  test("idempotent per engine", () => {
    const ce = engine();
    installPurityDefault(ce);
    ce.declare("Twice", { signature: "(number) -> number", evaluate: () => ce.number(1) });
    expect(pureOf(ce, "Twice")).toBe(true);
  });
});
