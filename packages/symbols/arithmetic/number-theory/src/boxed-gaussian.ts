import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt } from "@enumeratio/boxed";
import type { Gaussian } from "./gaussian.ts";

/** An integer part as MathJSON reads it: a JSON number, or `{ num }` past a double. */
const integerOf = (part: unknown): bigint | undefined => {
  if (typeof part === "number") return Number.isSafeInteger(part) ? BigInt(part) : undefined;
  const num = (part as { num?: unknown } | undefined)?.num;
  return typeof num === "string" && /^-?\d+$/.test(num) ? BigInt(num) : undefined;
};

/** The Gaussian integer an expression denotes — a rational integer included — or undefined. */
export function gaussianAt(expr: BoxedExpression | undefined): Gaussian | undefined {
  if (expr === undefined) return undefined;
  const n = bigIntegerAt(expr);
  if (n !== undefined) return [n, 0n];
  const json = expr.json;
  if (!Array.isArray(json) || json[0] !== "Complex") return undefined;
  const [re, im] = [integerOf(json[1]), integerOf(json[2])];
  return re === undefined || im === undefined ? undefined : [re, im];
}

/** Whether an expression is a Gaussian integer off the real line. */
export const isComplexGaussian = (expr: BoxedExpression | undefined): boolean => {
  const z = gaussianAt(expr);
  return z !== undefined && z[1] !== 0n;
};

const part = (x: bigint): number | { num: string } =>
  x >= BigInt(Number.MIN_SAFE_INTEGER) && x <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(x) : { num: x.toString() };

/** A Gaussian integer as an expression, exact in both parts. */
export const gaussianExpression = (ce: ComputeEngine, z: Gaussian): BoxedExpression =>
  z[1] === 0n ? ce.number(z[0]) : ce.box(["Complex", part(z[0]), part(z[1])] as never);
