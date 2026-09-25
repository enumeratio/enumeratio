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
    divergence: {
      type: "object",
      properties: {
        wolfram: { type: "string" },
        numpy: { type: "string" },
        sympy: { type: "string" },
      },
      additionalProperties: false,
    },
    volatile: { type: "array", items: { type: "string" } },
    hidden: { type: "boolean", description: "Deprecated: superseded by role: test." },
    others: { type: "object", additionalProperties: OTHER_SYSTEM_RUN },
  },
  required: ["expr", "expected"],
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

const IMPLEMENTATION_MESSAGE: JsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string" },
    note: { type: "string" },
    issue: { type: "integer" },
    tolerance: { type: "number" },
  },
  required: ["kind"],
  additionalProperties: false,
};

const SYSTEM_IMPLEMENTATION: JsonSchema = {
  type: "object",
  properties: {
    in: { type: "string" },
    out: { type: "string" },
    tex: { $ref: "#/$defs/RenderedForm" },
    verdict: OTHER_SYSTEM_VERDICT,
    messages: { type: "array", items: { $ref: "#/$defs/ImplementationMessage" } },
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
    RenderedForm: RENDERED_FORM,
    ImplementationMessage: IMPLEMENTATION_MESSAGE,
    SystemImplementation: SYSTEM_IMPLEMENTATION,
  },
};

// --- validation -----------------------------------------------------------------------------
//
// Just enough of a JSON Schema validator to check a parsed YAML record against the schemas
// above: no remote `$ref`s, no `$dynamicRef`, no format assertions. Good enough for a loader's
// data-quality gate; not a general-purpose validator, and not meant to become one.

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema {
  const match = /^#\/\$defs\/(.+)$/.exec(ref);
  const def = match ? root.$defs?.[match[1] as string] : undefined;
  if (def === undefined) throw new Error(`unresolvable $ref: ${ref}`);
  return def;
}

/**
 * Check `value` against `schema` (a schema produced above, or one of its `$defs`, resolved
 * against `root`). Returns human-readable problems; an empty array is a pass.
 */
export function validateSchema(
  schema: JsonSchema,
  value: unknown,
  root: JsonSchema = schema,
  path = "$",
): string[] {
  if (schema.$ref !== undefined)
    return validateSchema(resolveRef(schema.$ref, root), value, root, path);

  const problems: string[] = [];
  const fail = (message: string): void => void problems.push(`${path}: ${message}`);

  if (schema.anyOf !== undefined) {
    const results = schema.anyOf.map((branch) => validateSchema(branch, value, root, path));
    if (!results.some((r) => r.length === 0))
      fail(`matches none of ${schema.anyOf.length} allowed shapes`);
    return problems;
  }

  if (schema.const !== undefined && value !== schema.const)
    fail(`expected ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);

  if (schema.enum !== undefined && !schema.enum.includes(value))
    fail(`expected one of ${JSON.stringify(schema.enum)}, got ${JSON.stringify(value)}`);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = typeOf(value);
    const matches =
      types.includes(actual) ||
      (types.includes("integer") && actual === "number" && Number.isInteger(value));
    if (!matches) fail(`expected type ${types.join(" | ")}, got ${actual}`);
  }

  if (
    schema.pattern !== undefined &&
    typeof value === "string" &&
    !new RegExp(schema.pattern).test(value)
  )
    fail(`does not match /${schema.pattern}/`);

  if (
    schema.maxLength !== undefined &&
    typeof value === "string" &&
    value.length > schema.maxLength
  )
    fail(`longer than ${schema.maxLength} characters`);

  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum)
    fail(`less than minimum ${schema.minimum}`);

  if (schema.items !== undefined && Array.isArray(value)) {
    value.forEach((item, i) =>
      problems.push(...validateSchema(schema.items as JsonSchema, item, root, `${path}[${i}]`)),
    );
  }

  if (
    (schema.properties !== undefined ||
      schema.patternProperties !== undefined ||
      schema.additionalProperties !== undefined) &&
    typeOf(value) === "object"
  ) {
    const object = value as Record<string, unknown>;

    for (const key of schema.required ?? [])
      if (!(key in object)) fail(`missing required property "${key}"`);

    for (const [key, propValue] of Object.entries(object)) {
      const propSchema = schema.properties?.[key];
      if (propSchema !== undefined) {
        problems.push(...validateSchema(propSchema, propValue, root, `${path}.${key}`));
        continue;
      }
      const patternMatch = Object.entries(schema.patternProperties ?? {}).find(([pattern]) =>
        new RegExp(pattern).test(key),
      );
      if (patternMatch !== undefined) {
        problems.push(...validateSchema(patternMatch[1], propValue, root, `${path}.${key}`));
        continue;
      }
      if (schema.additionalProperties === false) fail(`unexpected property "${key}"`);
      else if (typeof schema.additionalProperties === "object")
        problems.push(
          ...validateSchema(schema.additionalProperties, propValue, root, `${path}.${key}`),
        );
    }
  }

  return problems;
}
