// Round-trip tests for the strict YAML schema and the single reader/writer (yaml.ts,
// design/examples-as-data.md §4). The property under test, run over a table of values
// instead of a generator (no property-testing library is a repo dependency yet): for every
// `value`, `parseYaml(stringifyYaml(value))` deep-equals `value`, and re-stringifying what
// was just parsed is a no-op (the writer is idempotent -- it doubles as the formatter).

import { expect, test } from "vite-plus/test";
import { isCanonicalYaml, parseYaml, stringifyYaml } from "../src/yaml.ts";

function roundTrips(value: unknown): void {
  const text = stringifyYaml(value);
  expect(parseYaml(text)).toEqual(value);
  expect(isCanonicalYaml(text)).toBe(true);
}

test("round-trips the strict-schema trap scalars as plain strings", () => {
  const traps = {
    coreBoolTrue: "True",
    coreBoolFalse: "False",
    coreBoolYes: "yes",
    coreBoolNo: "No",
    coreBoolOn: "on",
    coreNull: "NaN",
    coreInf: ".inf",
    coreNegInf: "-.inf",
    coreNan: ".nan",
    octal: "0o17",
    hex: "0x1F",
    leadingZero: "007",
  };
  roundTrips(traps);
  // None of these are the JS types they'd resolve to under YAML 1.2's core schema.
  const parsed = parseYaml(stringifyYaml(traps)) as Record<string, unknown>;
  for (const value of Object.values(parsed)) expect(typeof value).toBe("string");
});

test("round-trips the four strict scalar tags", () => {
  roundTrips({
    t: true,
    f: false,
    n: null,
    zero: 0,
    positive: 42,
    negative: -7,
    float: 3.5,
    negFloat: -0.25,
    exp: 1.5e21,
  });
});

test('quotes a string only when its plain form would misread -- "5" stays a string', () => {
  const value = { out: "5" };
  const text = stringifyYaml(value);
  expect(text).toBe("out: '5'\n");
  expect(parseYaml(text)).toEqual(value);
});

test("quotes strings shadowing the strict tags (true/false/null)", () => {
  const value = { a: "true", b: "false", c: "null" };
  const text = stringifyYaml(value);
  expect(text).toBe("a: 'true'\nb: 'false'\nc: 'null'\n");
  roundTrips(value);
});

test("leaves MathJSON-adjacent punctuation plain in block style", () => {
  const value = { in: "Mod(5, 0)", out: "NaN", tex: "\\operatorname{NaN}" };
  const text = stringifyYaml(value);
  expect(text).toBe("in: Mod(5, 0)\nout: NaN\ntex: \\operatorname{NaN}\n");
  roundTrips(value);
});

test("quotes a colon-space or hash-space that would otherwise be read as a comment or a key", () => {
  const value = { a: "(5 : ℤ)", b: "before # after" };
  const text = stringifyYaml(value);
  expect(text).toBe("a: '(5 : ℤ)'\nb: 'before # after'\n");
  roundTrips(value);
});

test("quotes a leading YAML indicator character", () => {
  for (const s of ["[x", "{x", "*x", "&x", "!x", "|x", ">x", "'x", '"x', "%x", "@x", "`x"]) {
    const text = stringifyYaml({ v: s });
    expect(parseYaml(text)).toEqual({ v: s });
    expect(text).not.toBe(`v: ${s}\n`);
  }
});

test("writes MathJSON (expr, expected) flow style and everything else block", () => {
  const example = {
    id: "zero-modulus",
    expr: ["Mod", 5, 0],
    expected: "NaN",
    caption: "Division by a 0 modulus yields NaN rather than an error",
    category: "Possible issues",
  };
  const text = stringifyYaml([example]);
  expect(text).toBe(
    [
      "- id: zero-modulus",
      "  expr: [Mod, 5, 0]",
      "  expected: NaN",
      "  caption: Division by a 0 modulus yields NaN rather than an error",
      "  category: Possible issues",
      "",
    ].join("\n"),
  );
  roundTrips([example]);
});

test("nested MathJSON stays flow at every depth", () => {
  const value = { expr: ["Add", ["Power", "x", 2], 1] };
  expect(stringifyYaml(value)).toBe("expr: [Add, [Power, x, 2], 1]\n");
  roundTrips(value);
});

test("a non-MathJSON array of scalars is still block, one item per line", () => {
  const value = { volatile: ["AbsoluteTimeUsed", "WallTime"] };
  expect(stringifyYaml(value)).toBe("volatile:\n  - AbsoluteTimeUsed\n  - WallTime\n");
  roundTrips(value);
});

test("writes an implementations record: own forms and a system row, both block", () => {
  const impls = {
    "zero-modulus": {
      epsil: { in: "Mod(5, 0)", out: "NaN" },
      wolfram: {
        in: "Mod[5, 0]",
        out: "Indeterminate",
        tex: { in: "(5 \\bmod 0)", out: "\\text{Indeterminate}" },
      },
      mathlib4: {
        in: "((5 : \u2124) % 0)",
        out: "5",
        verdict: "inconclusive",
        kind: "convention",
        note: "Lean defines x % 0 = x.",
        messages: [{ code: "eq-warn", text: "x % 0 unfolds to x by definition.", severity: "warning" }],
      },
    },
  };
  const text = stringifyYaml(impls);
  expect(text).toBe(
    [
      "zero-modulus:",
      "  epsil:",
      "    in: Mod(5, 0)",
      "    out: NaN",
      "  wolfram:",
      "    in: Mod[5, 0]",
      "    out: Indeterminate",
      "    tex:",
      "      in: (5 \\bmod 0)",
      "      out: \\text{Indeterminate}",
      "  mathlib4:",
      "    in: '((5 : \u2124) % 0)'",
      "    out: '5'",
      "    verdict: inconclusive",
      "    kind: convention",
      "    note: Lean defines x % 0 = x.",
      "    messages:",
      "      - code: eq-warn",
      "        text: x % 0 unfolds to x by definition.",
      "        severity: warning",
      "",
    ].join("\n"),
  );
  roundTrips(impls);
});

test("the writer is idempotent: stringifying a parsed round trip is a no-op", () => {
  const value = { a: [1, "x", true], b: { c: "plain", d: "'needs quoting: colon'" } };
  const once = stringifyYaml(value);
  const twice = stringifyYaml(parseYaml(once));
  expect(twice).toBe(once);
});
