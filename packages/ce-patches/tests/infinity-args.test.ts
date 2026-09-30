import { ComputeEngine } from "@cortex-js/compute-engine";
import { describe, expect, test } from "vite-plus/test";
import { applyAllPatches } from "../src/index.ts";

const ce = new ComputeEngine();
applyAllPatches(ce);

const at = (head: string, arg: string) => ce.box([head, arg]).evaluate();

describe("Arcsin/Arccos at the infinities", () => {
  test("Arcsin(+-Infinity) is a directed infinity along the imaginary axis", () => {
    expect(at("Arcsin", "PositiveInfinity").json).toEqual(["DirectedInfinity", ["Complex", 0, -1]]);
    expect(at("Arcsin", "NegativeInfinity").json).toEqual(["DirectedInfinity", ["Complex", 0, 1]]);
  });

  test("Arccos(+-Infinity) is the opposite directed infinity", () => {
    expect(at("Arccos", "PositiveInfinity").json).toEqual(["DirectedInfinity", ["Complex", 0, 1]]);
    expect(at("Arccos", "NegativeInfinity").json).toEqual(["DirectedInfinity", ["Complex", 0, -1]]);
  });

  test("Arcsin/Arccos(ComplexInfinity) is ComplexInfinity -- unbounded in every direction", () => {
    expect(at("Arcsin", "ComplexInfinity").json).toBe("ComplexInfinity");
    expect(at("Arccos", "ComplexInfinity").json).toBe("ComplexInfinity");
  });

  test("ordinary calls are untouched", () => {
    expect(ce.box(["Arcsin", ["Rational", 1, 2]]).evaluate().json).toEqual(["Multiply", ["Rational", 1, 6], "Pi"]);
  });
});

describe("Arctan/Arccot at ComplexInfinity", () => {
  test("both are Indeterminate", () => {
    expect(at("Arctan", "ComplexInfinity").json).toBe("Indeterminate");
    expect(at("Arccot", "ComplexInfinity").json).toBe("Indeterminate");
  });

  test("the real signed infinities are untouched (already native)", () => {
    expect(at("Arctan", "PositiveInfinity").json).toEqual(["Multiply", ["Rational", 1, 2], "Pi"]);
    expect(at("Arccot", "PositiveInfinity").json).toBe(0);
  });
});

describe("Hyperbolic inverses at the infinities", () => {
  test("Arcosh(-Infinity) = +Infinity -- Re >= 0 everywhere on the principal branch", () => {
    expect(at("Arcosh", "NegativeInfinity").json).toBe("PositiveInfinity");
  });

  test("Arsinh/Arcosh(ComplexInfinity) are ComplexInfinity, Artanh/Arsech Indeterminate", () => {
    expect(at("Arsinh", "ComplexInfinity").json).toBe("ComplexInfinity");
    expect(at("Arcosh", "ComplexInfinity").json).toBe("ComplexInfinity");
    expect(at("Artanh", "ComplexInfinity").json).toBe("Indeterminate");
    expect(at("Arsech", "ComplexInfinity").json).toBe("Indeterminate");
  });

  test("Arcoth/Arcsch(ComplexInfinity) were already 0 natively -- untouched", () => {
    expect(at("Arcoth", "ComplexInfinity").json).toBe(0);
    expect(at("Arcsch", "ComplexInfinity").json).toBe(0);
  });
});

describe("Ln at NegativeInfinity", () => {
  test("Ln(NegativeInfinity) = PositiveInfinity", () => {
    expect(at("Ln", "NegativeInfinity").json).toBe("PositiveInfinity");
  });

  // Exp(ComplexInfinity) is deliberately out of scope -- see arithmetic.ts's own comment.
  test("Exp is untouched (still canonicalizes to Power, unaffected by this patch)", () => {
    expect(at("Exp", "PositiveInfinity").json).toBe("PositiveInfinity");
    expect(at("Exp", "NegativeInfinity").json).toBe(0);
  });
});

describe("Erfc at ComplexInfinity", () => {
  // Erf itself is untouched here -- on a bare engine it still errors at boxing; the
  // "Indeterminate" answer seen through @enumeratio/analytic's declaredEngine() comes from
  // that package's own Erf redeclaration (generalized-special.ts), not from compute-engine
  // natively. Erfc widens to match that same convention. Erfi is deliberately out of scope
  // -- see distributions.ts's own comment.
  test("Erfc(ComplexInfinity) is Indeterminate", () => {
    expect(at("Erfc", "ComplexInfinity").json).toBe("Indeterminate");
  });
});

describe("Tan/Cot/Sec/Csc at every infinity", () => {
  test("all three infinities are Indeterminate -- poles arbitrarily close, no bounded interval", () => {
    for (const head of ["Tan", "Cot", "Sec", "Csc"]) {
      expect(at(head, "PositiveInfinity").json).toBe("Indeterminate");
      expect(at(head, "NegativeInfinity").json).toBe("Indeterminate");
      expect(at(head, "ComplexInfinity").json).toBe("Indeterminate");
    }
  });

  test("ordinary calls are untouched", () => {
    expect(ce.box(["Tan", 0]).evaluate().json).toBe(0);
    expect(ce.box(["Cot", ["Divide", "Pi", 4]]).evaluate().json).toBe(1);
  });
});
