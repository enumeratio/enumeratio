import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

// Interval/CenteredInterval/Around's Add/Multiply/Power/Subtract cases now have reference
// entries and live as examples (Interval, CenteredInterval, Around). What's left here is
// scope-dependent: analytic alone declines Multinomial's Around propagation because its
// domain check is integer-only -- number-theory's own Multinomial (loaded together with
// analytic in the full reference environment) is the one that actually propagates it, so
// this can only be pinned with analytic declared on its own.

const ce = new ComputeEngine();
declareAnalytic(ce);

const json = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Around: Multinomial's integer-only domain declines it, with analytic alone declared", () => {
  expect(json(["Multinomial", ["Around", 2, 0.01], 2])).toEqual(["Multinomial", ["Around", 2, 0.01], 2]);
});
