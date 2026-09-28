import { ComputeEngine } from "@cortex-js/compute-engine";
import { executeEpsil } from "@cortex-js/compute-engine/epsil";
import { operandsOf } from "@enumeratio/engine";
import { describe, expect, it } from "vite-plus/test";
import { ancestry, conform, declareStructures } from "../src/index.ts";

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
  // Money: whole units are its ticks, with a parity, so Round ties go to the even unit.
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
    MidpointOrder: {
      Midpoint: (a, b) => money(ce.function("Divide", [ce.function("Add", [amount(a), amount(b)]), 2]).evaluate()),
    },
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
    expect(ancestry("MidpointOrder")).toEqual(["PartialOrder", "FloorOrder", "MidpointOrder"]));

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
