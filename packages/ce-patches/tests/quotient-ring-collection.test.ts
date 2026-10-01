import { ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf } from "@enumeratio/engine";
import { describe, expect, test } from "vite-plus/test";
import { applyPatch, quotientRingCollection, setResidueClasses } from "../src/index.ts";

// A stand-in residue class, `Residue(k, m)`, so the patch is tested without a host package.
const withClasses = (): ComputeEngine => {
  const ce = new ComputeEngine();
  ce.declare("Residue", { signature: "(integer, integer) -> value" });
  applyPatch(ce, quotientRingCollection);
  setResidueClasses(ce, {
    element: (engine, k, m) => engine.function("Residue", [engine.number(k), engine.number(m)]),
    modulusOf: (x) => (x.operator === "Residue" ? bigIntegerAt(operandsOf(x)[1]) : undefined),
    type: "value",
  });
  return ce;
};

describe("QuotientRing(Integers, m) as a collection", () => {
  const ce = withClasses();

  test("counts its m classes", () => {
    expect(ce.box(["Count", ["QuotientRing", "Integers", 12]]).evaluate().json).toBe(12);
    const ring = ce.parse("\\mathbb{Z}/5\\mathbb{Z}");
    expect(ring.json).toEqual(["QuotientRing", "Integers", 5]);
    expect(ring.isCollection).toBe(true);
    expect(ring.isFiniteCollection).toBe(true);
    expect(ring.isEmptyCollection).toBe(false);
  });

  test("enumerates the classes 0, …, m − 1", () => {
    expect(ce.box(["ListFrom", ["QuotientRing", "Integers", 3]]).evaluate().json).toEqual([
      "List",
      ["Residue", 0, 3],
      ["Residue", 1, 3],
      ["Residue", 2, 3],
    ]);
  });

  test("membership is by modulus", () => {
    expect(ce.box(["Element", ["Residue", 3, 5], ["QuotientRing", "Integers", 5]]).evaluate().json).toBe("True");
    expect(ce.box(["Element", ["Residue", 3, 7], ["QuotientRing", "Integers", 5]]).evaluate().json).toBe("False");
  });

  test("is typed by its classes, not the base's integers", () => {
    const ring = ce.box(["QuotientRing", "Integers", 5]);
    expect(ring.type.matches("set<integer>")).toBe(false);
    expect(ring.type.toString()).toBe("set<value>");
  });

  test("a symbolic modulus, or another base, stays inert", () => {
    const symbolic = ce.box(["QuotientRing", "Integers", "n"]);
    expect(symbolic.isCollection).toBe(false);
    expect(symbolic.count).toBeUndefined();
    const zero = ce.box(["QuotientRing", "Integers", 0]);
    expect(zero.isCollection).toBe(false);
    expect(ce.box(["QuotientRing", "Rationals", 2]).isCollection).toBe(false);
  });
});

describe("QuotientRing(Integers, m) with no residue classes given", () => {
  const ce = new ComputeEngine();
  applyPatch(ce, quotientRingCollection);

  test("still counts, but neither enumerates nor decides membership", () => {
    const ring = ce.box(["QuotientRing", "Integers", 4]);
    expect(ring.count).toBe(4);
    expect(ring.type.toString()).toBe("set"); // set<unknown>
    expect([...ring.each()]).toEqual([]);
    expect(ce.box(["Element", 3, ring]).evaluate().json).toEqual(["Element", 3, ["QuotientRing", "Integers", 4]]);
  });
});
