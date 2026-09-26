import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/hurwitz-zeta.ts";
import { writeFileSync } from "node:fs";

const ce = new ComputeEngine();
declareAnalytic(ce);
const j = (expr: unknown) => ce.box(expr as never).evaluate().json;
const lines: string[] = [];
const log = (...args: unknown[]) =>
  lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));

test("smoke: Minimize quadratic", () => {
  const console = { log };
  console.log("min x^2", JSON.stringify(j(["Minimize", ["Power", "x", 2], "x"])));
  console.log(
    "max -x^2+4x-1",
    JSON.stringify(j(["Maximize", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], "x"])),
  );
  console.log("min x^3 (unbounded)", JSON.stringify(j(["Minimize", ["Power", "x", 3], "x"])));
  console.log(
    "min x^4-4x^2",
    JSON.stringify(j(["Minimize", ["Subtract", ["Power", "x", 4], ["Multiply", 4, ["Power", "x", 2]]], "x"])),
  );
  console.log(
    "min (x-1)/(x^2+1)",
    JSON.stringify(j(["Minimize", ["Divide", ["Subtract", "x", 1], ["Add", ["Power", "x", 2], 1]], "x"])),
  );
  console.log(
    "min {x^2, x>=1}",
    JSON.stringify(j(["Minimize", ["List", ["Power", "x", 2], ["GreaterEqual", "x", 1]], "x"])),
  );
  console.log(
    "max {-x^2+4x-1, 0<=x<=1}",
    JSON.stringify(
      j([
        "Maximize",
        [
          "List",
          ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1],
          ["And", ["GreaterEqual", "x", 0], ["LessEqual", "x", 1]],
        ],
        "x",
      ]),
    ),
  );
  console.log("min Log(x)", JSON.stringify(j(["Minimize", ["Ln", "x"], "x"])));
  console.log("min Exp(x)", JSON.stringify(j(["Minimize", ["Exp", "x"], "x"])));
  console.log("min Exp(-x)", JSON.stringify(j(["Minimize", ["Exp", ["Negate", "x"]], "x"])));
  console.log("MinValue Sin(x)", JSON.stringify(j(["MinValue", ["Sin", "x"], "x"])));
  console.log("MaxValue Cos(2x+1)", JSON.stringify(j(["MaxValue", ["Cos", ["Add", ["Multiply", 2, "x"], 1]], "x"])));
  console.log(
    "ArgMin x^2-4x+3",
    JSON.stringify(j(["ArgMin", ["Add", ["Power", "x", 2], ["Multiply", -4, "x"], 3], "x"])),
  );
  console.log(
    "ArgMax -x^2+4x-1",
    JSON.stringify(j(["ArgMax", ["Add", ["Negate", ["Power", "x", 2]], ["Multiply", 4, "x"], -1], "x"])),
  );
  console.log("ArgMax collection", JSON.stringify(j(["ArgMax", ["List", 3, 1, 4, 1, 5]])));
  console.log("ArgMin collection", JSON.stringify(j(["ArgMin", ["List", 3, 1, 4, 1, 5]])));
  console.log("Minimize const", JSON.stringify(j(["Minimize", 5, "x"])));
  console.log(
    "NMinimize x^4-x^2 on [-2,2]",
    JSON.stringify(
      j([
        "NMinimize",
        [
          "List",
          ["Subtract", ["Power", "x", 4], ["Power", "x", 2]],
          ["And", ["GreaterEqual", "x", -2], ["LessEqual", "x", 2]],
        ],
        "x",
      ]),
    ),
  );
  console.log(
    "NMaximize sin(x)+cos(2x) on [0,6]",
    JSON.stringify(
      j([
        "NMaximize",
        [
          "List",
          ["Add", ["Sin", "x"], ["Cos", ["Multiply", 2, "x"]]],
          ["And", ["GreaterEqual", "x", 0], ["LessEqual", "x", 6]],
        ],
        "x",
      ]),
    ),
  );
  console.log("NSum zeta2", JSON.stringify(j(["NSum", ["Power", "n", -2], ["List", "n", 1, "PositiveInfinity"]])));
  console.log(
    "NSum alt harmonic",
    JSON.stringify(j(["NSum", ["Divide", ["Power", -1, ["Add", "n", 1]], "n"], ["List", "n", 1, "PositiveInfinity"]])),
  );
  console.log(
    "NSum 1/n!",
    JSON.stringify(j(["NSum", ["Divide", 1, ["Factorial", "n"]], ["List", "n", 1, "PositiveInfinity"]])),
  );
  console.log("NSum 1/n^1.1", JSON.stringify(j(["NSum", ["Power", "n", -1.1], ["List", "n", 1, "PositiveInfinity"]])));
  console.log(
    "NSum harmonic (divergent)",
    JSON.stringify(j(["NSum", ["Divide", 1, "n"], ["List", "n", 1, "PositiveInfinity"]])),
  );
  console.log("NSum finite 1..5", JSON.stringify(j(["NSum", "n", ["List", "n", 1, 5]])));
  writeFileSync(
    "/Users/dlandolt/Playground/@enumeratio/enumeratio.dev/.claude/worktrees/agent-a8df1e9404bced602/.scratch/smoke-out.txt",
    lines.join("\n") + "\n",
  );
  expect(true).toBe(true);
});
