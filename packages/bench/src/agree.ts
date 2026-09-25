// The correctness gate (design/benchmarking.md §4.5): a system's answer must match the pinned
// one before its time counts. Exact answers compare as text, never through a double.

import { compare, normalise } from "@enumeratio/oracle/src";
import type { Precision } from "./types.ts";

/** Plain text of a MathJSON answer: bignum strings unwrapped, the rest as JSON. */
export function answerText(json: unknown): string {
  if (typeof json === "object" && json !== null && "num" in json) return String(json.num);
  return typeof json === "string" ? json : JSON.stringify(json);
}

export function agrees(value: string, expected: string, precision: Precision): boolean {
  if (precision === "exact") return normalise(value) === normalise(expected);
  const digits = precision === "machine" ? 15 : precision;
  return compare(value, expected, 10 ** -(Math.min(digits, 15) - 2)) === "agree";
}
