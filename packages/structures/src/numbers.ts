import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { operandsOf, stringAt } from "@enumeratio/engine";
import { conform } from "./conform.ts";

// compute-engine's own types, conforming. A real number is the model everything else
// imitates: its members are the native heads. The generic heads never reach these for a
// number -- they take the native path -- but a user's type built from reals can, and so can
// the members called by name.

const sign = (x: number): number => (Number.isNaN(x) ? Number.NaN : Math.sign(x));

export function conformNumbers(ce: ComputeEngine): void {
  const call = (head: string, ...args: BoxedExpression[]) => ce.function(head, args).evaluate();

  conform(ce, "real", {
    PartialOrder: { Compare: (a, b) => ce.number(sign(call("Subtract", a, b).N().re)) },
    LinearOrder: {},
    Lattice: { GreatestLowerBound: (a, b) => call("Min", a, b), LeastUpperBound: (a, b) => call("Max", a, b) },
    FloorOrder: { LowerTick: (x) => call("Floor", x), UpperTick: (x) => call("Ceil", x) },
    MidpointOrder: { Midpoint: (a, b) => call("Divide", call("Add", a, b), ce.number(2)) },
    TickParity: { IsEvenTick: (x) => call("IsEven", x) },
    Ring: {},
    FloorRing: { IntegerFloor: (x) => call("Floor", x), IntegerCeil: (x) => call("Ceil", x) },
  });

  // Strings by code unit, as compute-engine's `Sort` orders them.
  const order = (a: BoxedExpression, b: BoxedExpression): number => {
    const [x, y] = [stringAt(a) ?? "", stringAt(b) ?? ""];
    return x < y ? -1 : x > y ? 1 : 0;
  };
  conform(ce, "string", {
    PartialOrder: { Compare: (a, b) => ce.number(order(a, b)) },
    LinearOrder: {},
    Lattice: {
      GreatestLowerBound: (a, b) => (order(a, b) <= 0 ? a : b),
      LeastUpperBound: (a, b) => (order(a, b) >= 0 ? a : b),
    },
  });

  // The complex numbers as the product order on (Re, Im): ticks are the Gaussian integers, so
  // Floor(2.5 + 3.7i) is 2 + 3i, Wolfram's componentwise answer.
  const parts = (z: BoxedExpression) => [call("Re", z), call("Im", z)];
  conform(ce, "complex", {
    PartialOrder: {
      Compare: (a, b) => {
        const [c, d] = parts(a).map((p, i) => sign(call("Subtract", p, parts(b)[i]!).N().re));
        return ce.number(c === d || d === 0 ? c! : c === 0 ? d! : Number.NaN);
      },
    },
    ProductOrder: {
      Coordinates: (z) => ce.function("List", parts(z)),
      WithCoordinates: (_z, list) => call("Complex", ...operandsOf(list)),
    },
  });
}
