import { ComputeEngine } from "@cortex-js/compute-engine";
import { executeEpsil } from "@cortex-js/compute-engine/epsil";
import { operandsOf, symbolNameOf } from "@enumeratio/engine";
import { describe, expect, it } from "vite-plus/test";
import { ancestry, conform, declareAlgebra, declareStructures } from "../src/index.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareStructures(ce);
  return ce;
};

const evaluate = (ce: ComputeEngine, json: unknown) => ce.box(json as never).evaluate().json;

describe("the generic heads", () => {
  const ce = engine();
  const cases: [unknown, unknown][] = [
    // Numbers keep the native path.
    [["Min", 3, 1, 2], 1],
    [["Round", 2.5], 3],
    [["Round", -2.5], -3],
    // Members called by name: a real number's floor ring.
    [["IntegerFloor", -2.5], -3],
    [["IntegerCeil", -2.5], -2],
    [["Clamp", 5, 0, 3], 3],
    // Strings: a linear order.
    [["Min", "'b'", "'a'", "'c'"], "'a'"],
    [["Max", ["List", "'b'", "'a'"]], "'b'"],
    [["Clamp", "'z'", "'b'", "'m'"], "'m'"],
    // The complex numbers: the product order, so ticks are the Gaussian integers.
    [
      ["Floor", ["Complex", 2.5, 3.7]],
      ["Complex", 2, 3],
    ],
    [
      ["Ceil", ["Complex", 2.5, -3.7]],
      ["Complex", 3, -3],
    ],
    [
      ["Round", ["Complex", 2.5, 3.2]],
      ["Complex", 3, 3],
    ],
    [
      ["Min", ["Complex", 1, 2], ["Complex", 2, 1]],
      ["Complex", 1, 1],
    ],
    // A lazy collection is a pool, as it is natively.
    [["Max", ["Map", ["Function", ["Multiply", "_k", 2], "_k"], ["Range", 1, 3]]], 6],
    [["Min", ["Range", 4, 7]], 4],
    // Unknowns stay put.
    [
      ["Floor", "x"],
      ["Floor", "x"],
    ],
    [
      ["Min", "x", 2],
      ["Min", 2, "x"],
    ],
  ];
  for (const [input, expected] of cases) it(JSON.stringify(input), () => expect(evaluate(ce, input)).toEqual(expected));
});

describe("a type the engine has never seen", () => {
  // Money: a floor order that isn't a ring. Whole units are its ticks, with a parity, so
  // Round ties go to the even unit.
  const ce = engine();
  ce.declareType("money", "real", { mint: true } as never);
  ce.declare("Money", { signature: "(real) -> money" });
  const amount = (m: ReturnType<typeof ce.box>) => operandsOf(m)[0]!;
  const money = (x: ReturnType<typeof ce.box>) => ce.function("Money", [x]);
  const real = (head: string) => (m: ReturnType<typeof ce.box>) => ce.function(head, [amount(m)]).evaluate();
  conform(ce, "money", {
    PartialOrder: { Compare: (a, b) => ce.number(Math.sign(amount(a).re - amount(b).re)) },
    LinearOrder: {},
    FloorOrder: { LowerTick: (m) => money(real("Floor")(m)), UpperTick: (m) => money(real("Ceil")(m)) },
    AffineMidpoint: {
      Midpoint: (a, b) => money(ce.function("Divide", [ce.function("Add", [amount(a), amount(b)]), 2]).evaluate()),
    },
    MidpointOrder: {},
    TickParity: { IsEvenTick: (m) => real("IsEven")(m) },
  });

  const M = (x: unknown) => ["Money", x];
  const cases: [unknown, unknown][] = [
    [["Min", M(3), M(1), M(2)], M(1)],
    [["Max", M(3), M(1)], M(3)],
    [["Floor", M(2.7)], M(2)],
    [["Ceil", M(2.2)], M(3)],
    [["Round", M(2.4)], M(2)],
    [["Round", M(2.5)], M(2)],
    [["Round", M(3.5)], M(4)],
    [["Round", M(4)], M(4)],
  ];
  for (const [input, expected] of cases) it(JSON.stringify(input), () => expect(evaluate(ce, input)).toEqual(expected));
});

describe("a conformance declared in Epsil", () => {
  const ce = engine();
  executeEpsil(
    ce,
    `type boolean is PartialOrder {
  function Compare(self, other: Self) -> number { If(self == other, 0, If(self, 1, -1)) }
}
type boolean is LinearOrder`,
  );
  const cases: [string, unknown][] = [
    ["Min(True, False)", "False"],
    ["Max(True, False, True)", "True"],
    ["Clamp(False, True, True)", "True"],
  ];
  for (const [source, expected] of cases)
    it(source, () => expect(executeEpsil(ce, source).value?.json).toEqual(expected));
});

describe("refinement", () => {
  it("lists a protocol's parents first", () =>
    expect(ancestry("FloorRing")).toEqual(["PartialOrder", "LinearOrder", "Ring", "FloorOrder", "FloorRing"]));

  it("refuses a conformance missing a parent", () => {
    const ce = engine();
    ce.declareType("thing", "integer", { mint: true } as never);
    expect(() =>
      conform(ce, "thing", {
        Lattice: { GreatestLowerBound: (a) => a, LeastUpperBound: (a) => a },
      }),
    ).toThrow(/claims Lattice but not PartialOrder/);
  });
});

describe("a family of algebras", () => {
  // A two-dimensional toy: basis 1 and t, and t is its only non-scalar element.
  const ce = engine();
  ce.declareType("toy_algebra", "expression<ToyAlgebra>", { mint: true });
  ce.declare("ToyAlgebra", { signature: "(integer) -> toy_algebra" });
  declareAlgebra(ce, {
    type: "toy_algebra",
    basis: () => ce.function("List", [ce.One, ce.symbol("t")]),
    dimension: () => ce.number(2),
    contains: (x) => ce.symbol(symbolNameOf(x) === "t" ? "True" : "False"),
  });
  const cases: [unknown, unknown][] = [
    [
      ["Basis", ["ToyAlgebra", 1]],
      ["List", 1, "t"],
    ],
    [["AlgebraDimension", ["ToyAlgebra", 1]], 2],
    [["Element", "t", ["ToyAlgebra", 1]], "True"],
    [["Element", "u", ["ToyAlgebra", 1]], "False"],
    // Not an algebra: Element stays native.
    [["Element", 3, "Integers"], "True"],
  ];
  for (const [input, expected] of cases) it(JSON.stringify(input), () => expect(evaluate(ce, input)).toEqual(expected));
});
