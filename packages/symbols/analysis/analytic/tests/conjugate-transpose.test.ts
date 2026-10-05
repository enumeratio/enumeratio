// unstable: a bare engine to declare the analytic library against
import { ComputeEngine } from "@enumeratio/engine/unstable";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = new ComputeEngine();
declareAnalytic(ce);

const evalOf = (expr: unknown) => ce.box(expr as never).evaluate().json;

test("Conjugate of a symbolic Transpose holds, as in Wolfram, instead of a type error", () => {
  expect(evalOf(["Conjugate", ["Transpose", "m"]])).toEqual(["Conjugate", ["Transpose", "m"]]);
});

test("Conjugate still conjugates numbers", () => {
  expect(evalOf(["Conjugate", ["Complex", 1, 2]])).toEqual(["Complex", 1, -2]);
  expect(evalOf(["Conjugate", "z"])).toEqual(["Conjugate", "z"]);
});
