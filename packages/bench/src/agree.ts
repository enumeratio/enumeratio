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
  const match = /^\s*([-+]?)(\d*)(?:\.(\d*))?(?:[eE]([-+]?\d+)|\*\^([-+]?\d+))?\s*$/.exec(text.replace(/`[\d.]*/g, ""));
  if (match === null || (match[2] === "" && (match[3] ?? "") === "")) return undefined;
  const frac = match[3] ?? "";
  const m = BigInt(`${match[1]}${match[2] || "0"}${frac}`);
  return { m, e: Number(match[4] ?? match[5] ?? 0) - frac.length };
}

const abs = (n: bigint): bigint => (n < 0n ? -n : n);

/** Split at the commas outside any bracket. */
function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(from, i).trim());
      from = i + 1;
    }
  }
  out.push(text.slice(from).trim());
  return out.filter((part) => part !== "");
}

/**
 * A list answer's elements, however the system printed it: Wolfram's `{…}`, Python's, Julia's
 * and Rust's `[…]`, or our MathJSON `["List", …]`. `undefined` for anything not a list.
 */
export function elements(text: string): string[] | undefined {
  const t = text.trim();
  if (t.startsWith("[")) {
    try {
      const json = JSON.parse(t) as unknown;
      if (Array.isArray(json) && json[0] === "List") return json.slice(1).map((e) => answerText(e));
    } catch {
      // not JSON: a bracketed list in some system's syntax
    }
  }
  const open = t[0];
  const close = t[t.length - 1];
  if (!((open === "{" && close === "}") || (open === "[" && close === "]"))) return undefined;
  return splitTop(t.slice(1, -1));
}

const NUM = String.raw`(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+|\*\^[-+]?\d+)?`;
const COMPLEX = new RegExp(String.raw`^([-+]?${NUM})?(?:([-+])(${NUM})?)?(?:\*?I|j|im)$`);

/** A number's parts, `[re]` or `[re, im]`, as decimal text: every system's complex spelling. */
function parts(text: string): string[] | undefined {
  let t = text.replace(/`[\d.]*/g, "").replace(/\s+/g, "");
  if (t.startsWith("[")) {
    try {
      const json = JSON.parse(t) as unknown;
      if (Array.isArray(json) && json[0] === "Complex") return [answerText(json[1]), answerText(json[2])];
    } catch {
      return undefined;
    }
  }
  const wl = /^Complex\[(.*),(.*)\]$/.exec(t);
  if (wl !== null) return [wl[1]!, wl[2]!];
  if (t.startsWith("(") && t.endsWith(")")) t = t.slice(1, -1);
  if (decimal(t) !== undefined) return [t];
  const z = COMPLEX.exec(t);
  if (z === null) return undefined;
  // `a+b*I`, `a-bj`, `b*I` (no real part), `a+I` (unit imaginary part)
  if (z[2] === undefined) return ["0", z[1] ?? "1"];
  return [z[1] ?? "0", `${z[2]}${z[3] ?? "1"}`];
}

/** Agreement to `digits` significant digits of the largest part, in exact decimal arithmetic. */
function agreeDigits(a: string, b: string, digits: number): boolean | undefined {
  const pa = parts(a);
  const pb = parts(b);
  if (pa === undefined || pb === undefined) return undefined;
  const xs = [...pa, ...Array(Math.max(0, pb.length - pa.length)).fill("0")].map(decimal);
  const ys = [...pb, ...Array(Math.max(0, pa.length - pb.length)).fill("0")].map(decimal);
  if (xs.some((x) => x === undefined) || ys.some((y) => y === undefined)) return undefined;
  const all = [...xs, ...ys] as { m: bigint; e: number }[];
  const e = Math.min(...all.map((d) => d.e));
  const scaled = all.map((d) => d.m * 10n ** BigInt(d.e - e));
  const scale = scaled.reduce((max, m) => (abs(m) > max ? abs(m) : max), 0n);
  const n = xs.length;
  return scaled.slice(0, n).every((x, i) => abs(x - scaled[n + i]!) * 10n ** BigInt(digits) <= scale);
}

function agreesOne(value: string, expected: string, precision: Precision): boolean {
  if (precision === "exact") return normalise(value) === normalise(expected);
  // Two digits of slack: the last places of a correctly rounded answer can differ.
  const digits = (precision === "machine" ? 15 : precision) - 2;
  return agreeDigits(value, expected, digits) ?? compare(value, expected, 10 ** -Math.min(digits, 13)) === "agree";
}

/** A list answer agrees element by element; anything else as one value. */
export function agrees(value: string, expected: string, precision: Precision): boolean {
  const want = elements(expected);
  if (want === undefined) return agreesOne(value, expected, precision);
  const got = elements(value);
  return got !== undefined && got.length === want.length && got.every((g, i) => agreesOne(g, want[i]!, precision));
}
