// JSON Schema for the two YAML records (design/examples-as-data.md §2, §4), generated from
// the types in `types.ts` -- so an editor with a YAML language server gets completion and
// validation on `reference/<Head>.yaml` and `reference/<Head>.implementations.yaml`. This
// module is the generator; `scripts/generate-schema.ts` writes its output to `schema/`, and
// `tests/schema.test.ts` fails if the committed files drift from it.
//
// Hand-written, not reflected off the TypeScript types: there is no type-to-JSON-Schema
// step in this repo's toolchain, and the two schemas are small and stable enough that
// keeping them in sync by eye (with the test as a tripwire) beats a new build-time
// dependency. A JSON Schema author needs the *serialized* shape anyway, which for `expr` /
// `expected` is "any JSON value", not the `MathJSON` union as TypeScript sees it.

import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";

/** A minimal JSON Schema value -- just enough of draft 2020-12 for these two documents. */
export interface JsonSchema {
  readonly $schema?: string;
  readonly $id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly type?: string | readonly string[];
  readonly enum?: readonly unknown[];
  readonly const?: unknown;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchema;
  readonly patternProperties?: Readonly<Record<string, JsonSchema>>;
  readonly items?: JsonSchema;
  readonly anyOf?: readonly JsonSchema[];
  readonly $ref?: string;
  readonly $defs?: Readonly<Record<string, JsonSchema>>;
  readonly pattern?: string;
  readonly maxLength?: number;
  readonly minimum?: number;
}

const MATHJSON: JsonSchema = {
  description: "A MathJSON expression: form-agnostic compute-engine input/output.",
  anyOf: [
    { type: "number" },
    { type: "string" },
    { type: "boolean" },
    { type: "array", items: { $ref: "#/$defs/MathJSON" } },
    { type: "object" },
  ],
};

const EXAMPLE_ROLE: JsonSchema = { enum: ["demo", "test"] };

const OTHER_SYSTEM_VERDICT: JsonSchema = { enum: ["agree", "disagree", "inconclusive", "error"] };

const OTHER_SYSTEM_RUN: JsonSchema = {
  type: "object",
  properties: {
    input: { type: "string" },
    output: { type: "string" },
    verdict: OTHER_SYSTEM_VERDICT,
    kind: { type: "string" },
    note: { type: "string" },
    tolerance: { type: "number" },
    issue: { type: "integer" },
    shown: { type: "string" },
    tex: {
      type: "object",
      properties: { input: { type: "string" }, output: { type: "string" } },
      required: ["input", "output"],
      additionalProperties: false,
    },
  },
  required: ["input", "output", "verdict"],
  additionalProperties: false,
};

const REFERENCE_EXAMPLE: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", maxLength: 48 },
    expr: { $ref: "#/$defs/MathJSON" },
    expected: { $ref: "#/$defs/MathJSON" },
    caption: { type: "string" },
    category: { type: "string" },
    role: EXAMPLE_ROLE,
    aspirational: { type: "boolean" },
    volatile: { type: "array", items: { type: "string" } },
    hidden: { type: "boolean", description: "Deprecated: superseded by role: test." },
    group: {
      type: "string",
      description: "Cases of one example: those sharing a group show as one cycling card.",
    },
    others: { type: "object", additionalProperties: OTHER_SYSTEM_RUN },
  },
  required: ["id", "expr", "expected"],
  additionalProperties: false,
};

const REFERENCE_SIGNATURE: JsonSchema = {
  type: "object",
  properties: {
    call: { type: "string" },
    description: { type: "string" },
    library: { type: "string" },
    arity: { type: "integer" },
    references: { type: "array", items: { $ref: "#/$defs/Reference" } },
  },
  required: ["call", "description"],
  additionalProperties: false,
};

const ENVIRONMENT: JsonSchema = { enum: ["engine", "browser", "gpu", "node", "external"] };

const IMPLEMENTATION_ORIGIN: JsonSchema = {
  enum: ["reference", "native", "compiled", "component", "mapped"],
};

const REFERENCE_IMPLEMENTATION: JsonSchema = {
  type: "object",
  properties: {
    origin: IMPLEMENTATION_ORIGIN,
    form: { type: "string" },
    environment: ENVIRONMENT,
    expr: { $ref: "#/$defs/MathJSON" },
    source: { type: "string" },
    code: { type: "string" },
    produces: { type: "string" },
    note: { type: "string" },
  },
  required: ["origin", "form"],
  additionalProperties: false,
};

const REFERENCE: JsonSchema = {
  type: "object",
  properties: {
    system: { type: "string" },
    identity: { type: "string" },
    url: { type: "string" },
    note: { type: "string" },
    relation: { enum: ["partial", "aggregate", "conceptual"] },
    arity: { type: "integer" },
  },
  required: ["system", "identity"],
  additionalProperties: false,
};

/** `reference/<Head>.yaml`: the hand-written entry (design/examples-as-data.md §2). */
export const REFERENCE_ENTRY_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/reference-entry.schema.json",
  title: "ReferenceEntry",
  description:
    "One compute-engine head's reference/<Head>.yaml: summary, signatures, details, " +
    "references, head-level implementations, and examples in page order.",
  type: "object",
  properties: {
    name: { type: "string" },
    domain: { type: "string" },
    signature: { type: "string" },
    summary: { type: "string" },
    examples: { type: "array", items: { $ref: "#/$defs/ReferenceExample" } },
    enumerate: {
      type: "object",
      properties: {
        expr: { type: "string" },
        columns: { type: "string" },
        glyph: { type: "string" },
        pageSize: { type: "integer" },
      },
      required: ["expr"],
      additionalProperties: false,
    },
    seeAlso: { type: "array", items: { type: "string" } },
    signatures: { type: "array", items: { $ref: "#/$defs/ReferenceSignature" } },
    details: { type: "array", items: { type: "string" } },
    outForm: { type: "string" },
    outEvaluate: { type: "boolean" },
    implementations: { type: "array", items: { $ref: "#/$defs/ReferenceImplementation" } },
    primitive: { enum: ["kernel", "numeric", "foreign", "axiom"] },
    references: { type: "array", items: { $ref: "#/$defs/Reference" } },
    stub: { enum: ["engine", "carrier"] },
  },
  required: ["name", "domain", "signature", "summary", "examples"],
  additionalProperties: false,
  $defs: {
    MathJSON: MATHJSON,
    ReferenceExample: REFERENCE_EXAMPLE,
    ReferenceSignature: REFERENCE_SIGNATURE,
    ReferenceImplementation: REFERENCE_IMPLEMENTATION,
    Reference: REFERENCE,
  },
};

const RENDERED_FORM: JsonSchema = {
  type: "object",
  properties: { in: { type: "string" }, out: { type: "string" } },
  required: ["in", "out"],
  additionalProperties: false,
};

const EVALUATION_MESSAGE: JsonSchema = {
  type: "object",
  properties: {
    code: { type: "string" },
    text: { type: "string" },
    severity: { enum: ["warning", "error"] },
  },
  required: ["code", "text"],
  additionalProperties: false,
};

const SYSTEM_IMPLEMENTATION: JsonSchema = {
  type: "object",
  properties: {
    in: { type: "string" },
    out: { type: "string" },
    shown: { type: "string" },
    tex: { $ref: "#/$defs/RenderedForm" },
    verdict: OTHER_SYSTEM_VERDICT,
    kind: { type: "string" },
    note: { type: "string" },
    issue: { type: "integer" },
    tolerance: { type: "number" },
    messages: { type: "array", items: { $ref: "#/$defs/EvaluationMessage" } },
    back: { $ref: "#/$defs/MathJSON" },
  },
  required: ["in"],
  additionalProperties: false,
};

/**
 * `reference/<Head>.implementations.yaml`: every example's implementations, keyed by id
 * (design/examples-as-data.md §2, §6).
 */
export const HEAD_IMPLEMENTATIONS_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/head-implementations.schema.json",
  title: "HeadImplementations",
  description:
    "One compute-engine head's reference/<Head>.implementations.yaml: every example's " +
    "own forms and each external system's rendering and answer, keyed by example id.",
  type: "object",
  additionalProperties: {
    type: "object",
    additionalProperties: { $ref: "#/$defs/SystemImplementation" },
  },
  $defs: {
    MathJSON: MATHJSON,
    RenderedForm: RENDERED_FORM,
    EvaluationMessage: EVALUATION_MESSAGE,
    SystemImplementation: SYSTEM_IMPLEMENTATION,
  },
};

// --- validation -----------------------------------------------------------------------------
//
// ajv (draft 2020-12) does the checking; this only turns its errors into one line each, in
// the `$.examples[0].role: …` form the loader reports.

const ajv = new Ajv2020({ allErrors: true, verbose: true, strict: false });
const compiled = new WeakMap<JsonSchema, ValidateFunction>();

/** `/examples/0/role` → `$.examples[0].role`. */
const pathOf = (pointer: string): string =>
  `$${pointer
    .split("/")
    .slice(1)
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    .map((part) => (/^\d+$/.test(part) ? `[${part}]` : `.${part}`))
    .join("")}`;

const describe = (error: ErrorObject): string => {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return `missing required property "${String(params.missingProperty)}"`;
    case "additionalProperties":
      return `unexpected property "${String(params.additionalProperty)}"`;
    case "enum":
      return `expected one of ${JSON.stringify(params.allowedValues)}, got ${JSON.stringify(error.data)}`;
    case "pattern":
      return `does not match /${String(params.pattern)}/`;
    case "anyOf":
      return `matches none of ${(error.schema as unknown[]).length} allowed shapes`;
    default:
      return error.message ?? error.keyword;
  }
};

/**
 * Check `value` against `schema` (one of the two above). Returns human-readable problems;
 * an empty array is a pass. Inside a failed `anyOf`, only the `anyOf` itself is reported.
 */
export function validateSchema(schema: JsonSchema, value: unknown): string[] {
  let validate = compiled.get(schema);
  if (validate === undefined) {
    validate = ajv.compile(schema as object);
    compiled.set(schema, validate);
  }
  if (validate(value)) return [];
  const errors = validate.errors ?? [];
  const anyOfs = errors.filter((e) => e.keyword === "anyOf").map((e) => e.schemaPath);
  return errors
    .filter((e) => e.keyword === "anyOf" || !anyOfs.some((p) => e.schemaPath.startsWith(`${p}/`)))
    .map((e) => `${pathOf(e.instancePath)}: ${describe(e)}`);
}
