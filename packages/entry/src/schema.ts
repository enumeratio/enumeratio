// JSON Schema for the two YAML records (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2, §4), generated from
// the types in `types.ts` -- so an editor with a YAML language server gets completion and
// validation on `reference/<Head>/index.md` and `reference/<Head>/examples.values.*.tsv`. This
// module is the generator; `scripts/generate-schema.ts` writes its output to `schema/` (at build, uncommitted).
//
// Hand-written, not reflected off the TypeScript types: there is no type-to-JSON-Schema
// step in this repo's toolchain, and the two schemas are small and stable enough that
// keeping them in sync by eye beats a new build-time
// dependency. A JSON Schema author needs the *serialized* shape anyway, which for `expr` /
// `expected` is "any JSON value", not the `MathJSON` union as TypeScript sees it.

import { OWN_FORMS } from "./order.ts";
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
  readonly exclusiveMinimum?: number;
  readonly dependentRequired?: Readonly<Record<string, readonly string[]>>;
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

const EXAMPLE_ROLE: JsonSchema = { enum: ["demo", "test", "aspirational", "triage"] };

const TRIAGE_BUCKET: JsonSchema = {
  enum: ["adapt", "emit", "compare", "ours?", "wolfram?", "unscanned", "gap", "print"],
};

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
    known: { $ref: "#/$defs/MathJSON" },
    tolerance: { type: "number", exclusiveMinimum: 0 },
    source: { type: "string" },
    caption: { type: "string" },
    category: { type: "string" },
    role: EXAMPLE_ROLE,
    triage: TRIAGE_BUCKET,
    volatile: { type: "array", items: { type: "string" } },
    group: {
      type: "string",
      description: "Cases of one example: those sharing a group show as one cycling card.",
    },
    others: { type: "object", additionalProperties: OTHER_SYSTEM_RUN },
  },
  required: ["id", "expr", "expected"],
  // A known value carries where it comes from; a tolerance or source means nothing without one.
  dependentRequired: { known: ["source"], source: ["known"], tolerance: ["known"], triage: ["role"] },
  additionalProperties: false,
};

const REFERENCE_SIGNATURE: JsonSchema = {
  type: "object",
  properties: {
    call: { type: "string" },
    description: { type: "string" },
    library: { type: "string" },
    arity: { type: "integer" },
    type: { type: "string" },
    overrides: { type: "string" },
    on: { type: "array", items: { type: "string" } },
    symbols: { type: "array", items: { type: "string" } },
    types: { type: "array", items: { type: "string" } },
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
    arity: { type: "integer" },
    template: { type: "string" },
    threadArg: { type: "integer" },
    note: { type: "string" },
    counterpart: { const: false },
    checked: {
      type: "object",
      properties: {
        version: { type: "string" },
        on: { type: "string" },
      },
      required: ["version", "on"],
      additionalProperties: false,
    },
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
    on: { type: "string" },
  },
  required: ["system", "identity"],
  additionalProperties: false,
};

const CATALOG_GRADE: JsonSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    role: { enum: ["axis", "param"] },
  },
  required: ["name", "role"],
  additionalProperties: false,
};

const ENTRY_LAW: JsonSchema = {
  description:
    "A combinatorial map's law, in the shorthand vocabulary -- see EntryLaw. `on` " +
    "disambiguates a law for one overload of a shared name (BinaryTree is two maps).",
  anyOf: [
    { enum: ["involution", "idempotent"] },
    {
      type: "object",
      properties: { inverse: { type: "string" }, on: { type: "string" } },
      required: ["inverse"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        orderIsomorphism: {
          type: "object",
          properties: {
            from: { type: "string" },
            to: { type: "string" },
            sizeOffset: { type: "integer" },
          },
          required: ["from", "to"],
          additionalProperties: false,
        },
        on: { type: "string" },
      },
      required: ["orderIsomorphism"],
      additionalProperties: false,
    },
  ],
};

const REFERENCE_NAMES: JsonSchema = {
  type: "object",
  properties: {
    fungrim: { type: "string" },
    dlmf: { type: "string" },
    wikidata: { type: "string" },
    wikidataConfirmed: { type: "boolean" },
    catalog: { type: "string" },
    wolfram: { type: "string" },
    wolframIdentity: { type: "boolean" },
  },
  additionalProperties: false,
};

/** `reference/<Head>/index.md`: the hand-written entry, all but its examples (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2). */
export const REFERENCE_ENTRY_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/reference-entry.schema.json",
  title: "ReferenceEntry",
  description:
    "One compute-engine head's reference/<Head>/index.md: summary, signatures, details, " +
    "references, the catalog's own crosswalk rows and head-level bindings. Its examples " +
    "are in <Head>/examples.tsv.",
  type: "object",
  properties: {
    name: { type: "string" },
    domain: { type: "string" },
    signature: { type: "string" },
    summary: { type: "string" },
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
    bindings: { type: "array", items: { $ref: "#/$defs/ReferenceBinding" } },
    primitive: { enum: ["kernel", "numeric", "foreign", "axiom"] },
    references: { type: "array", items: { $ref: "#/$defs/Reference" } },
    catalog: { type: "array", items: { $ref: "#/$defs/Reference" } },
    carrier: { type: "string" },
    grades: { type: "array", items: { $ref: "#/$defs/CatalogGrade" } },
    unbounded: { type: "boolean" },
    catalogCarrier: { const: true },
    statOn: { type: "array", items: { type: "string" } },
    mapOn: { type: "array", items: { type: "string" } },
    names: { $ref: "#/$defs/ReferenceNames" },
    formerly: { type: "array", items: { type: "string" } },
    stub: { enum: ["engine", "carrier"] },
    attributes: { type: "array", items: { enum: ["HoldAll"] } },
    laws: { type: "array", items: { $ref: "#/$defs/EntryLaw" } },
  },
  required: ["name", "domain", "signature", "summary"],
  additionalProperties: false,
  $defs: {
    MathJSON: MATHJSON,
    ReferenceSignature: REFERENCE_SIGNATURE,
    ReferenceBinding: REFERENCE_IMPLEMENTATION,
    Reference: REFERENCE,
    CatalogGrade: CATALOG_GRADE,
    ReferenceNames: REFERENCE_NAMES,
    EntryLaw: ENTRY_LAW,
  },
};

/** `reference/<Head>/examples.tsv`: the head's examples, in page order. */
export const REFERENCE_EXAMPLES_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/reference-examples.schema.json",
  title: "ReferenceExamples",
  description: "One compute-engine head's reference/<Head>/examples.tsv: its examples, in page order.",
  type: "array",
  items: { $ref: "#/$defs/ReferenceExample" },
  $defs: { MathJSON: MATHJSON, ReferenceExample: REFERENCE_EXAMPLE, Reference: REFERENCE },
};

const COMPONENT_STORY: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[a-z0-9]+(-[a-z0-9]+)*$", maxLength: 48 },
    caption: { type: "string" },
    category: { type: "string" },
    notes: { type: "string" },
    expr: { $ref: "#/$defs/MathJSON" },
  },
  required: ["id", "caption", "expr"],
  additionalProperties: false,
};

/** `packages/components/reference/<Name>.stories.yaml`: one component's stories, in page order. */
export const COMPONENT_STORIES_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/component-stories.schema.json",
  title: "ComponentStories",
  description: "One component's <Name>.stories.yaml: its stories, in page order.",
  type: "array",
  items: { $ref: "#/$defs/ComponentStory" },
  $defs: { MathJSON: MATHJSON, ComponentStory: COMPONENT_STORY },
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
    backOut: { $ref: "#/$defs/MathJSON" },
  },
  required: ["in"],
  additionalProperties: false,
};

/** Our own forms' pins: any of a row's fields, since a pin may hold only an `out` or a `back`. */
const PINNED_FORM: JsonSchema = { ...SYSTEM_IMPLEMENTATION, required: [] };

/**
 * A head's implementations, from `reference/<Head>/examples.values.*.tsv` and examples.tsv's
 * `<system>.<field>` columns: every example's, keyed by id
 * (https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data §2, §6).
 */
export const HEAD_IMPLEMENTATIONS_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/head-implementations.schema.json",
  title: "HeadImplementations",
  description:
    "One compute-engine head's implementations (reference/<Head>/examples.values.*.tsv, and " +
    "examples.tsv's <system>.<field> columns): every example's pinned own forms and each " +
    "external system's rendering and answer, keyed by example id.",
  type: "object",
  additionalProperties: {
    type: "object",
    properties: Object.fromEntries(OWN_FORMS.map((form) => [form, { $ref: "#/$defs/PinnedForm" }])),
    additionalProperties: { $ref: "#/$defs/SystemImplementation" },
  },
  $defs: {
    MathJSON: MATHJSON,
    RenderedForm: RENDERED_FORM,
    EvaluationMessage: EVALUATION_MESSAGE,
    SystemImplementation: SYSTEM_IMPLEMENTATION,
    PinnedForm: PINNED_FORM,
  },
};

/** A symbol's mappings (`mappings.json`): its references, bindings and implementations, for a library's targets. */
export const SYMBOL_MAPPINGS_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://enumeratio.dev/schema/symbol-mappings.schema.json",
  title: "SymbolMappings",
  description:
    "What a library symbol is mapped to outside itself, for the targets the library tracks: " +
    "the ids other sources give it, how other systems write it, and each example as they write and answer it.",
  type: "object",
  properties: {
    references: { type: "array", items: { $ref: "#/$defs/Reference" } },
    bindings: { type: "array", items: { $ref: "#/$defs/ReferenceBinding" } },
    implementations: {
      type: "object",
      additionalProperties: { type: "object", additionalProperties: { $ref: "#/$defs/SystemImplementation" } },
    },
  },
  additionalProperties: false,
  $defs: {
    MathJSON: MATHJSON,
    Reference: REFERENCE,
    ReferenceBinding: REFERENCE_IMPLEMENTATION,
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
