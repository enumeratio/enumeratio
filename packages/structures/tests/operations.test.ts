import { ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf } from "@enumeratio/engine";
import { describe, expect, it } from "vite-plus/test";
import {
  declareStructures,
  OperationCollisionError,
  registerCarrier,
  registerCollectionCarrier,
  registerOperation,
} from "../src/index.ts";

// A toy carrier: `Tagged(n)`, an integer with a type of its own.
const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareStructures(ce);
  ce.declareType("tagged", "integer", { mint: true });
  ce.declare("Tagged", { signature: "(integer) -> tagged" });
  registerCarrier(ce, { name: "Tagged", type: "tagged" });
  const value = (x: ReturnType<typeof ce.box>) => operandsOf(x)[0]!.re;
  registerOperation(ce, "CombinatorialStatistic", "Tagged", {
    name: "Double",
    findstat: ["St999999"],
    type: "integer",
    definition: (x) => ce.number(2 * value(x)),
  });
  registerOperation(ce, "CombinatorialMap", "Tagged", {
    name: "Successor",
    type: "tagged",
    definition: (x) => ce.function("Tagged", [ce.number(value(x) + 1)]),
  });
  registerCollectionCarrier(ce, "Range", "Tagged");
  return ce;
};

const evaluate = (ce: ComputeEngine, json: unknown) => ce.box(json as never).evaluate().json;

describe("operations on a carrier", () => {
  const ce = engine();
  const cases: [unknown, unknown][] = [
    [["CombinatorialStatistic", ["Tagged", 5], "'Double'"], 10],
    // A FindStat id is another key for the same statistic.
    [["CombinatorialStatistic", ["Tagged", 5], "'St999999'"], 10],
    [
      ["CombinatorialMap", ["Tagged", 5], "'Successor'"],
      ["Tagged", 6],
    ],
    // Unknown names, and values of no registered carrier, stay as written.
    [
      ["CombinatorialStatistic", ["Tagged", 5], "'Nope'"],
      ["CombinatorialStatistic", ["Tagged", 5], "'Nope'"],
    ],
    [
      ["CombinatorialStatistic", 5, "'Double'"],
      ["CombinatorialStatistic", 5, "'Double'"],
    ],
    // A statistic of the collection itself.
    [["CombinatorialStatistic", ["Range", 1, 4], "'Count'"], 4],
  ];
  for (const [input, expected] of cases) it(JSON.stringify(input), () => expect(evaluate(ce, input)).toEqual(expected));

  it("maps a statistic over a collection", () =>
    expect(
      ce.box(["CombinatorialStatistic", ["Range", 1, 3], "'Double'"] as never).evaluate({ materialization: true }).json,
    ).toEqual(["List", 2, 4, 6]));

  it("prefers a kernel, and keeps the definition beside it", () => {
    registerOperation(ce, "CombinatorialStatistic", "Tagged", { name: "Double", kernel: () => ce.number(-1) });
    expect(evaluate(ce, ["CombinatorialStatistic", ["Tagged", 5], "'Double'"])).toEqual(-1);
  });

  it("refuses a second definition of the same operation", () =>
    expect(() =>
      registerOperation(ce, "CombinatorialStatistic", "Tagged", { name: "Double", definition: () => ce.One }),
    ).toThrow(OperationCollisionError));
});
