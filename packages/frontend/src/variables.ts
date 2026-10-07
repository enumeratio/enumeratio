// A scope's variables, as its `Variables` option declares them: a map from each wildcard to
// what it may be, so a hole that names it (`{_d}` in prose, `_d` in Epsil, `\sqrt{_d}` in TeX)
// needs no more than its name. The domain picks the control a hole shows; a hole may still
// override it.
//
//   Variables -> [
//     _d -> Variable(Integers, -5, Where -> IsSquareFree && !IsSquare, Range -> [-400, 400]),
//     _h -> [Labeled(Associates, "associates"), Labeled(Multiples, "multiples")],
//     _s -> []]
//
// A declaration's value is a starting value (its domain inferred), a domain (`Integers`,
// `Reals`, `Booleans`), a list of choices, or `Variable(domain, start, …)` when it needs more.

/** MathJSON, loosely: declarations are read from it without the engine's types. */
type Json = unknown;

export type Domain =
  | {
      readonly kind: "integers";
      /** Bounds a stepper keeps to and a random draw comes from. */
      readonly min: number;
      readonly max: number;
      /** Which integers a stepper lands on: `IsSquareFree && !IsSquare`. */
      readonly where?: (n: number) => boolean;
    }
  | { readonly kind: "reals"; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: "choices"; readonly values: readonly Json[]; readonly labels: readonly string[] }
  | { readonly kind: "booleans" }
  | { readonly kind: "any" };

export interface VariableSpec {
  /** The name, without its wildcard's `_`. */
  readonly name: string;
  readonly domain: Domain;
  readonly start: Json;
}

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);
const isRule = (json: Json): boolean =>
  ["Rule", "KeyValuePair", "Tuple"].includes(headOf(json) ?? "") && argsOf(json).length === 2;
const stringOf = (json: Json): string | undefined =>
  typeof json === "string" && /^'.*'$/s.test(json) ? json.slice(1, -1) : undefined;

/** A number from MathJSON: a number, or `Negate` of one. */
function numberOf(json: Json): number | undefined {
  if (typeof json === "number") return json;
  if (headOf(json) === "Negate") {
    const n = numberOf(argsOf(json)[0]);
    return n === undefined ? undefined : -n;
  }
  return undefined;
}

const isSquare = (n: number): boolean => n >= 0 && Number.isInteger(Math.sqrt(n));

/** Integer tests a `Where` may name. */
export const INTEGER_TESTS: Readonly<Record<string, (n: number) => boolean>> = {
  IsSquareFree: (n) => {
    if (n === 0) return false;
    const m = Math.abs(n);
    for (let k = 2; k * k <= m; k++) if (m % (k * k) === 0) return false;
    return true;
  },
  IsSquare: isSquare,
  IsPrime: (n) => {
    if (n < 2) return false;
    for (let k = 2; k * k <= n; k++) if (n % k === 0) return false;
    return true;
  },
  IsOdd: (n) => Math.abs(n % 2) === 1,
  IsEven: (n) => n % 2 === 0,
  IsPositive: (n) => n > 0,
  IsNegative: (n) => n < 0,
  IsNonZero: (n) => n !== 0,
};

/** `Where`'s test: a name from `INTEGER_TESTS`, or `&&`, `||`, `!` of them; undefined otherwise. */
export function integerTestOf(json: Json): ((n: number) => boolean) | undefined {
  if (typeof json === "string") return INTEGER_TESTS[json];
  const parts = argsOf(json).map(integerTestOf);
  if (parts.some((p) => p === undefined)) return undefined;
  const ts = parts as ((n: number) => boolean)[];
  switch (headOf(json)) {
    case "And":
      return (n) => ts.every((t) => t(n));
    case "Or":
      return (n) => ts.some((t) => t(n));
    case "Not":
      return ts.length === 1 ? (n) => !ts[0]!(n) : undefined;
  }
  return undefined;
}

/** A choice and the word it shows: `Labeled(Associates, "associates")`, or itself. */
function choiceOf(json: Json): [Json, string] {
  if (headOf(json) === "Labeled") {
    const [value, label] = argsOf(json);
    return [value, stringOf(label) ?? String(label)];
  }
  return [json, stringOf(json) ?? (typeof json === "string" ? json : JSON.stringify(json))];
}

/** Default reach of an unbounded integer domain, for a random draw. */
const INTEGER_REACH = 100;

function domainOf(json: Json, start: Json, options: ReadonlyMap<string, Json>): Domain {
  const range = argsOf(options.get("Range")).map(numberOf);
  const [lo, hi] = range.length === 2 && range.every((x) => x !== undefined) ? (range as number[]) : [];
  if (json === "Integers" || (json === undefined && Number.isInteger(numberOf(start)))) {
    const where = integerTestOf(options.get("Where"));
    return { kind: "integers", min: lo ?? -INTEGER_REACH, max: hi ?? INTEGER_REACH, ...(where ? { where } : {}) };
  }
  if (json === "Reals" || (json === undefined && numberOf(start) !== undefined)) {
    const s = numberOf(start) ?? 0;
    const [min, max] = [lo ?? Math.min(0, 2 * s), hi ?? Math.max(1, 2 * Math.abs(s))];
    return { kind: "reals", min, max, step: numberOf(options.get("Step")) ?? (max - min) / 100 };
  }
  if (json === "Booleans" || (json === undefined && (start === "True" || start === "False")))
    return { kind: "booleans" };
  if (headOf(json) === "List" && argsOf(json).length > 0) {
    const choices = argsOf(json).map(choiceOf);
    return { kind: "choices", values: choices.map(([v]) => v), labels: choices.map(([, l]) => l) };
  }
  return { kind: "any" };
}

const START: Readonly<Record<string, Json>> = { integers: 0, reals: 0, booleans: "False" };

/** One declaration's value as a spec for `name`. */
export function variableOf(name: string, json: Json): VariableSpec {
  if (headOf(json) === "Variable") {
    const args = argsOf(json);
    const options = new Map(args.filter(isRule).map((r) => [String(argsOf(r)[0]), argsOf(r)[1]] as const));
    const [domain, start] = args.filter((a) => !isRule(a));
    const d = domainOf(domain, start, options);
    return { name, domain: d, start: start ?? (d.kind === "choices" ? d.values[0] : START[d.kind]) };
  }
  if (json === "Integers" || json === "Reals" || json === "Booleans") {
    const d = domainOf(json, undefined, new Map());
    return { name, domain: d, start: START[d.kind] };
  }
  if (headOf(json) === "List" && argsOf(json).length > 0) {
    const d = domainOf(json, undefined, new Map());
    return { name, domain: d, start: d.kind === "choices" ? d.values[0] : json };
  }
  return { name, domain: domainOf(undefined, json, new Map()), start: json };
}

/** The declarations of a `Variables` value: a list of `_name -> declaration`. */
export function variablesOf(json: Json): VariableSpec[] {
  const entries = headOf(json) === "List" ? argsOf(json) : json === undefined ? [] : [json];
  const specs: VariableSpec[] = [];
  for (const entry of entries) {
    if (!isRule(entry)) continue;
    const [key, value] = argsOf(entry);
    if (typeof key !== "string" || !/^_[A-Za-z]\w*$/.test(key)) continue;
    specs.push(variableOf(key.slice(1), value));
  }
  return specs;
}

/** The next value a domain admits from `n`, in a direction; `n` itself when there is none in reach. */
export function stepInteger(domain: Extract<Domain, { kind: "integers" }>, n: number, direction: 1 | -1): number {
  for (let m = n + direction; m >= domain.min && m <= domain.max; m += direction)
    if (domain.where?.(m) ?? true) return m;
  return n;
}

/** Draws a random value takes before it settles for the current one. */
const RANDOM_TRIES = 200;

/** A random value the domain admits, other than `n`; `n` when none turns up. */
export function randomInteger(domain: Extract<Domain, { kind: "integers" }>, n: number, random = Math.random): number {
  for (let k = 0; k < RANDOM_TRIES; k++) {
    const m = domain.min + Math.floor(random() * (domain.max - domain.min + 1));
    if (m !== n && (domain.where?.(m) ?? true)) return m;
  }
  return n;
}

/**
 * TeX with each hole filled: `_d` or `_{name}` with nothing before it to subscript (start of
 * text, `{`, `(`, `[`, a space, an operator) is the variable `d`'s value, as TeX. A subscript on
 * something (`x_d`) is left alone.
 */
export function fillTex(tex: string, values: ReadonlyMap<string, string>): string {
  return tex.replace(
    /(^|[\s{([,=+\-*/^|])_(?:\{([A-Za-z]\w*)\}|([A-Za-z]))/g,
    (whole, before: string, long?: string, short?: string) => {
      const v = values.get(long ?? short ?? "");
      return v === undefined ? whole : `${before}{${v}}`;
    },
  );
}
