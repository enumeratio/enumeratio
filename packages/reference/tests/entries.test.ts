// Buildless src subpath: the reference tests must run without a prior `vp pack` of
// @enumeratio/analytic (CI runs tests before builds).
import { runCases } from "@enumeratio/aestimatio/src/node";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/index.ts";

/** A `{num}` literal's digit string, or `undefined` for anything else. */
const numOf = (x: unknown): string | undefined =>
  typeof x === "object" && x !== null && typeof (x as { num?: unknown }).num === "string"
    ? (x as { num: string }).num
    : undefined;

/** A number's decimal digits, whether it came as a `{num}` literal or a plain double. */
const decimalOf = (x: unknown): string | undefined =>
  typeof x === "number" ? String(x) : numOf(x);

/** A decimal string reduced to sign, significant digits and exponent, so that `"0.50"`,
 * `"5e-1"` and `".5"` compare equal while any difference in a significant digit does not. */
const canonicalDecimal = (num: string): string => {
  const [mantissa = "", exponent = "0"] = num.toLowerCase().split("e");
  const negative = mantissa.startsWith("-");
  const [whole = "", fraction = ""] = mantissa.replace(/^[-+]/, "").split(".");
  const digits = `${whole}${fraction}`;
  const leading = digits.length - digits.replace(/^0+/, "").length;
  const significant = digits.replace(/^0+/, "").replace(/0+$/, "");
  if (significant === "") return "0";
  const power = Number(exponent) + whole.length - leading;
  return `${negative ? "-" : ""}0.${significant}e${power}`;
};

/** An example that asks for digits: `N(x, d)`. Its answer is a promise about every digit it
 * shows, so it is compared digit for digit (see `settled`). */
const asksForDigits = (expr: unknown): boolean =>
  Array.isArray(expr) && expr[0] === "N" && expr.length === 3;

/**
 * `output` with each number that matches `expected`'s replaced by it.
 *
 * - `exact`, for an `N(x, d)` example: every significant digit must match, the last one
 *   included, and a double where `d` digits were asked for fails. Those digits come from
 *   compute-engine's decimal arithmetic, which is the same on every platform.
 * - Otherwise a float within 1e-12 (relative) matches: the last digits of a double differ
 *   between platforms (ARM against x86), and that is not a change in behaviour.
 *
 * Integers and every structure have to match exactly either way.
 */
const settled = (output: unknown, expected: unknown, exact: boolean): unknown => {
  if (exact) {
    const [a, b] = [decimalOf(output), decimalOf(expected)];
    if (a !== undefined && b !== undefined) {
      return canonicalDecimal(a) === canonicalDecimal(b) ? expected : output;
    }
  } else {
    const float = (x: unknown): number | undefined =>
      typeof x === "number" && !Number.isInteger(x)
        ? x
        : numOf(x) === undefined
          ? undefined
          : Number(numOf(x));
    const [a, b] = [float(output), float(expected)];
    if (a !== undefined && b !== undefined && Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a), Math.abs(b)) ? expected : output;
    }
  }
  if (Array.isArray(output) && Array.isArray(expected) && output.length === expected.length) {
    return output.map((item, i) => settled(item, expected[i], exact));
  }
  return output;
};

/** Blank the values of rules keyed by one of `keys`, wherever they sit in the tree. */
const masked = (node: unknown, keys: ReadonlySet<string>): unknown => {
  if (!Array.isArray(node)) return node;
  const key = typeof node[1] === "string" ? node[1].replace(/^'|'$/g, "") : undefined;
  if ((node[0] === "Tuple" || node[0] === "KeyValuePair") && key !== undefined && keys.has(key)) {
    return [node[0], node[1], "…"];
  }
  return node.map((child) => masked(child, keys));
};

// `@enumeratio/aestimatio/node`'s `runCases` `setup` module — declares every library the
// reference engine declares (see scripts/engines.ts's own comment on why it's not
// `DECLARATIONS` verbatim: the worker's engine already has `@enumeratio/aestimatio`).
const setup = new URL("../scripts/engines.ts", import.meta.url).href;

/** Per-example caps: generous for a real reference example, tight enough that a runaway
 * one fails fast instead of hanging the suite or eating the machine's memory (this box
 * OOM'd once already — see design/aestimatio.md §3). */
const TIME_MS = 10_000;
const MEMORY_BYTES = 512 * 1024 * 1024;
// Modest on purpose: several examples can still exceed their own cap independently
// without piling up enough worker memory at once to matter.
const CONCURRENCY = 3;

const id = (entryName: string, index: number): string => `${entryName}#${index}`;

// Re-evaluate every documented example, each in its own worker with its own time/memory
// cap, and pin it to `expected`. A change in compute-engine's behaviour (or a bad example)
// fails here instead of shipping a wrong reference page; a runaway example fails as
// "Aborted" instead of hanging the whole suite.
const cases = entries.flatMap((entry) =>
  entry.examples.map((example, index) => ({ id: id(entry.name, index), input: example.expr })),
);
const results = await runCases(cases, {
  setup,
  timeMs: TIME_MS,
  memoryBytes: MEMORY_BYTES,
  // A lazy collection's `expected` is its elements, not the call.
  materialize: true,
  concurrency: CONCURRENCY,
});
const resultById = new Map(results.map((result) => [result.id, result]));

for (const entry of entries) {
  for (const [index, example] of entry.examples.entries()) {
    const label = example.aspirational ? " (gap)" : "";
    test(`${entry.name} example ${index + 1}${label}`, () => {
      const result = resultById.get(id(entry.name, index));
      if (result === undefined) {
        throw new Error(`runCases: no result for ${entry.name} example ${index + 1}`);
      }
      if (result.outcome === "Error") {
        throw new Error(`evaluation raised: ${result.reason}`);
      }
      if (result.outcome === "Aborted") {
        throw new Error(
          `exceeded the ${TIME_MS}ms/${MEMORY_BYTES}-byte cap — tighten the example or raise the cap`,
        );
      }

      const volatile = new Set(example.volatile ?? []);
      const output = masked(result.value, volatile);
      const expected = masked(example.expected, volatile);
      if (example.aspirational) {
        // A documented capability gap: CE should NOT yet match the borrowed
        // target. If this starts matching, promote it (drop `aspirational`).
        expect(output).not.toEqual(expected);
      } else {
        expect(settled(output, expected, asksForDigits(example.expr))).toEqual(expected);
      }
    });
  }
}
