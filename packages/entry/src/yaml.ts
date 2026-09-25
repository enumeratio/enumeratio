// The strict YAML schema and the single reader/writer (design/examples-as-data.md §4). Every
// `reference/<Head>.yaml` and `reference/<Head>.implementations.yaml` file goes through these
// two functions, and nothing else in the repo is allowed to import `yaml` directly (see
// `packages/utils/tests/no-yaml-imports.test.ts`) -- a stray `yaml.parse` with YAML 1.2's core
// schema would quietly turn `True` into `true` and `0o17` into `15`.
//
// The base is the `failsafe` schema (string/map/seq only -- nothing implicitly typed), plus
// four scalar tags of our own: `true`/`false` lowercase only, `null`, and JSON-grammar
// integers and floats. Everything else stays a string: `True`, `NaN`, `No`, `.inf`, `0o17`.
// That is the JSON scalar model with YAML's syntax, so a parsed record means exactly what its
// JSON would.

import {
  Document,
  isMap,
  isSeq,
  parse,
  type Pair,
  type ScalarTag,
  type SchemaOptions,
  visit,
} from "yaml";

const JSON_INT = /^-?(0|[1-9][0-9]*)$/;
const JSON_FLOAT_LITERAL = /^-?(0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?$/;

const BOOL_TAG: ScalarTag = {
  identify: (value) => typeof value === "boolean",
  default: true,
  tag: "tag:yaml.org,2002:bool",
  test: /^(true|false)$/,
  resolve: (source) => source === "true",
  stringify: (item) => String(item.value),
};

const NULL_TAG: ScalarTag = {
  identify: (value) => value === null,
  default: true,
  tag: "tag:yaml.org,2002:null",
  test: /^null$/,
  resolve: () => null,
  stringify: () => "null",
};

const INT_TAG: ScalarTag = {
  identify: (value) => typeof value === "number" && Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:int",
  test: JSON_INT,
  resolve: (source) => parseInt(source, 10),
  stringify: (item) => String(item.value),
};

const FLOAT_TAG: ScalarTag = {
  identify: (value) => typeof value === "number" && !Number.isInteger(value),
  default: true,
  tag: "tag:yaml.org,2002:float",
  // A fraction or exponent is required, or this would also match plain integers -- `int` is
  // tried first (see STRICT_TAGS order) but an identify-time float like `5.0` still needs to
  // fail this test to round-trip as `5`, not loop back through `int`.
  test: /^-?(0|[1-9][0-9]*)(?:\.[0-9]+(?:[eE][-+]?[0-9]+)?|[eE][-+]?[0-9]+)$/,
  resolve: (source) => parseFloat(source),
  stringify: (item) => {
    const n = item.value as number;
    return JSON_FLOAT_LITERAL.test(String(n)) ? String(n) : n.toExponential();
  },
};

/** The four scalar tags added to `failsafe`. Order matters: `int` is tried before `float`. */
const STRICT_TAGS: ScalarTag[] = [BOOL_TAG, NULL_TAG, INT_TAG, FLOAT_TAG];

const SCHEMA_OPTIONS: SchemaOptions = {
  schema: "failsafe",
  customTags: STRICT_TAGS,
};

/**
 * Parse YAML text under the strict scalar schema. `True`, `NaN`, `No`, `yes`, `.inf` and
 * `0o17` all come back as plain strings; only lowercase `true`/`false`, `null`, and
 * JSON-grammar integers and floats are typed.
 */
export function parseYaml(text: string): unknown {
  return parse(text, SCHEMA_OPTIONS);
}

/** The map key a node was found under, from `visit`'s ancestry path, or `undefined` at the root. */
function pairKey(path: readonly unknown[]): unknown {
  const parent = path[path.length - 1];
  if (parent == null || typeof parent !== "object" || !("key" in parent)) return undefined;
  const key = (parent as Pair).key;
  return key !== null && typeof key === "object" && "value" in key
    ? (key as { value: unknown }).value
    : key;
}

/** True if `path` (a `visit` ancestry) descends from a map key in `mathJsonKeys`. */
function underMathJsonKey(path: readonly unknown[], mathJsonKeys: ReadonlySet<string>): boolean {
  for (const step of path) {
    const key = pairKey([step]);
    if (typeof key === "string" && mathJsonKeys.has(key)) return true;
  }
  return false;
}

export interface StringifyOptions {
  /**
   * Field names whose value is MathJSON: it and every array/map nested inside it are
   * rendered in flow style (`[Mod, 5, 0]`), the only thing this writer ever flow-styles.
   * Defaults to `expr` and `expected` (`ReferenceExample`, `ReferenceImplementation`).
   */
  readonly mathJsonKeys?: readonly string[];
}

const DEFAULT_MATHJSON_KEYS: readonly string[] = ["expr", "expected"];

/**
 * Stringify a value under the strict scalar schema. This is the single writer: every
 * mapping and sequence is block style, one item per line, except a MathJSON value (§4),
 * which is flow style throughout. A plain scalar is quoted only when its unquoted form
 * would not read back as itself -- it matches one of the strict tags (an `out` of `"5"`,
 * `"true"`, `"null"`), it opens with a YAML indicator character, or it contains `": "` or
 * `" #"`. `Mod(5, 0)`, `NaN` and `\operatorname{NaN}` all stay plain.
 */
export function stringifyYaml(value: unknown, options: StringifyOptions = {}): string {
  const mathJsonKeys = new Set(options.mathJsonKeys ?? DEFAULT_MATHJSON_KEYS);
  const doc = new Document(value, SCHEMA_OPTIONS);
  visit(doc, (_key, node, path) => {
    if (!isMap(node) && !isSeq(node)) return;
    if (underMathJsonKey(path, mathJsonKeys)) node.flow = true;
  });
  return doc.toString({ singleQuote: true, lineWidth: 0, flowCollectionPadding: false });
}

/** True if `text` is exactly what {@link stringifyYaml} would produce for its own parse. */
export function isCanonicalYaml(text: string, options?: StringifyOptions): boolean {
  return stringifyYaml(parseYaml(text), options) === text;
}
