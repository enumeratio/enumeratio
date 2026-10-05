import { createEngine } from "@enumeratio/engine/testing";
import { expect, test } from "vite-plus/test";
import { declareAnalytic } from "../src/declare.ts";

const ce = createEngine(declareAnalytic);

// Ln(x+2) - Ln(2-x) is Ln((x+2)/(2-x)) only where both arguments are positive: a rewrite that
// ignores the signs is wrong on part of the domain (Wolfram keeps the difference too).
const difference = ["Add", ["Negate", ["Ln", ["Subtract", 2, "x"]]], ["Ln", ["Add", 2, "x"]]] as const;

const heads = (expr: unknown): string[] => {
  const out: string[] = [];
  const walk = (e: unknown): void => {
    if (!Array.isArray(e)) return;
    out.push(String(e[0]));
    e.slice(1).forEach(walk);
  };
  walk(expr);
  return out;
};

test("a difference of logs of unknown sign stays split, however it is reached", () => {
  for (const head of [undefined, "ExpToTrig", "Simplify", "FullSimplify"]) {
    const boxed = ce.box(head === undefined ? (difference as never) : ([head, difference] as never));
    const result = (head === "Simplify" || head === "FullSimplify" ? boxed.simplify() : boxed.evaluate()).json;
    expect(heads(result).filter((h) => h === "Ln").length, `${head}: ${JSON.stringify(result)}`).toBe(2);
  }
});
