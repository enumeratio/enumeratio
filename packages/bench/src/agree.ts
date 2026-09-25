// The correctness gate (design/benchmarking.md §4.5): a system's answer must match the pinned
// one before its time counts. Exact answers compare as text, never through a double.

import { compare, normalise } from "@enumeratio/oracle/src";
import type { Precision } from "./types.ts";

/** Plain text of a MathJSON answer: bignum strings unwrapped, the rest as JSON. */
export function answerText(json: unknown): string {
  if (typeof json === "object" && json !== null && "num" in json) return String(json.num);
  return typeof json === "string" ? json : JSON.stringify(json);
}

/** A real decimal as `mantissa × 10^exponent`, exactly; `undefined` for anything else. */
function decimal(text: string): { readonly m: bigint; readonly e: number } | undefined {
  const match = /^\s*([-+]?)(\d*)(?:\.(\d*))?(?:[eE]([-+]?\d+)|\*\^([-+]?\d+))?\s*$/.exec(
    text.replace(/`[\d.]*/g, ""),
  );
  if (match === null || (match[2] === "" && (match[3] ?? "") === "")) return undefined;
  const frac = match[3] ?? "";
  const m = BigInt(`${match[1]}${match[2] || "0"}${frac}`);
  return { m, e: Number(match[4] ?? match[5] ?? 0) - frac.length };
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

/** Relative agreement to `digits` significant digits, in exact decimal arithmetic. */
function agreeDigits(a: string, b: string, digits: number): boolean | undefined {
  const x = decimal(a);
  const y = decimal(b);
  if (x === undefined || y === undefined) return undefined;
  const e = Math.min(x.e, y.e);
  const xm = x.m * 10n ** BigInt(x.e - e);
  const ym = y.m * 10n ** BigInt(y.e - e);
  const scale = abs(xm) > abs(ym) ? abs(xm) : abs(ym);
  return abs(xm - ym) * 10n ** BigInt(digits) <= scale;
}

export function agrees(value: string, expected: string, precision: Precision): boolean {
  if (precision === "exact") return normalise(value) === normalise(expected);
  // Two digits of slack: the last places of a correctly rounded answer can differ.
  const digits = (precision === "machine" ? 15 : precision) - 2;
  return (
    agreeDigits(value, expected, digits) ??
    compare(value, expected, 10 ** -Math.min(digits, 13)) === "agree"
  );
}
