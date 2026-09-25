// `validateSchema` actually rejects: a validator nobody has seen fail is not evidence of
// anything (see packages/reference/tests/implementations.test.ts for the same principle).

import { expect, test } from "vite-plus/test";
import {
  HEAD_IMPLEMENTATIONS_SCHEMA,
  REFERENCE_ENTRY_SCHEMA,
  validateSchema,
} from "../src/schema.ts";

const MINIMAL_ENTRY = {
  name: "Mod",
  domain: "Numbers",
  signature: "Mod(a, b)",
  summary: "Remainder of a divided by b.",
  examples: [{ id: "zero-modulus", expr: ["Mod", 5, 0], expected: "NaN" }],
};

test("a well-formed entry passes", () => {
  expect(validateSchema(REFERENCE_ENTRY_SCHEMA, MINIMAL_ENTRY)).toEqual([]);
});

test("a well-formed entry with id and role passes", () => {
  expect(
    validateSchema(REFERENCE_ENTRY_SCHEMA, {
      ...MINIMAL_ENTRY,
      examples: [{ ...MINIMAL_ENTRY.examples[0], id: "zero-modulus", role: "test" }],
    }),
  ).toEqual([]);
});

test("rejects a missing required field", () => {
  const { summary: _summary, ...withoutSummary } = MINIMAL_ENTRY;
  expect(validateSchema(REFERENCE_ENTRY_SCHEMA, withoutSummary)).toEqual([
    '$: missing required property "summary"',
  ]);
});

test("rejects an unknown property (typo guard)", () => {
  expect(validateSchema(REFERENCE_ENTRY_SCHEMA, { ...MINIMAL_ENTRY, summarry: "oops" })).toEqual([
    '$: unexpected property "summarry"',
  ]);
});

test("rejects a malformed id", () => {
  expect(
    validateSchema(REFERENCE_ENTRY_SCHEMA, {
      ...MINIMAL_ENTRY,
      examples: [{ ...MINIMAL_ENTRY.examples[0], id: "Not_Valid" }],
    }),
  ).toEqual(["$.examples[0].id: does not match /^[a-z0-9]+(-[a-z0-9]+)*$/"]);
});

test("rejects an invalid role", () => {
  expect(
    validateSchema(REFERENCE_ENTRY_SCHEMA, {
      ...MINIMAL_ENTRY,
      examples: [{ ...MINIMAL_ENTRY.examples[0], role: "hidden" }],
    }),
  ).toEqual(['$.examples[0].role: expected one of ["demo","test"], got "hidden"']);
});

const MINIMAL_IMPLEMENTATIONS = {
  "zero-modulus": {
    epsil: { in: "Mod(5, 0)", out: "NaN" },
    wolfram: { in: "Mod[5, 0]", out: "Indeterminate" },
  },
};

test("a well-formed implementations record passes", () => {
  expect(validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, MINIMAL_IMPLEMENTATIONS)).toEqual([]);
});

test("rejects a system row missing its required `in`", () => {
  expect(
    validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, {
      "zero-modulus": { wolfram: { out: "Indeterminate" } },
    }),
  ).toEqual(['$.zero-modulus.wolfram: missing required property "in"']);
});

test("rejects an unknown verdict", () => {
  expect(
    validateSchema(HEAD_IMPLEMENTATIONS_SCHEMA, {
      "zero-modulus": { wolfram: { in: "Mod[5, 0]", verdict: "maybe" } },
    }),
  ).toEqual([
    '$.zero-modulus.wolfram.verdict: expected one of ["agree","disagree","inconclusive","error"], got "maybe"',
  ]);
});
