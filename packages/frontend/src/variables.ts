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
// `Reals`, `Booleans`), a list of choices, or `Variable(domain, start, …)` when it needs more;
// `Variable(Automatic, [(6, 0)])` starts a variable at a list without making it choices.

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
  /**
   * Lattice points of a ring, one `(a, b)` or a list of them: `GaussianIntegers`'s a + bi,
   * `EisensteinIntegers`'s a + bω. The ring may be another variable's value (`_r`).
   */
  | { readonly kind: "points"; readonly ring: Json; readonly min?: number; readonly max?: number }
  /** Choices a library supplies by name (`ComplexBases`), resolved by `resolveNamedDomains`. */
  | { readonly kind: "named"; readonly name: string }
  | { readonly kind: "any" };

/** Rings whose lattice points a variable may range over, and the unit each writes its points with. */
export const POINT_RINGS: Readonly<Record<string, string>> = { GaussianIntegers: "i", EisensteinIntegers: "ω" };

/** A lattice point as its ring writes it: `−1 + i`, `2ω`, `3`; `(a, b)` for an unknown ring. */
export function pointWords(ring: Json, point: Json): string {
  const coords = Array.isArray(point) && point[0] === "Tuple" ? point.slice(1) : undefined;
  const [a, b] = (coords ?? []).map((c) => numberOf(c));
  if (a === undefined || b === undefined) return JSON.stringify(point);
  const unit = typeof ring === "string" ? POINT_RINGS[ring] : undefined;
  const signed = (x: number): string => (x < 0 ? `−${-x}` : String(x));
  if (unit === undefined) return `(${signed(a)}, ${signed(b)})`;
  if (b === 0) return signed(a);
  const term = `${b === 1 ? "" : b === -1 ? "−" : signed(b)}${unit}`;
  return a === 0 ? term : `${signed(a)} ${b < 0 ? "−" : "+"} ${term.replace(/^−/, "")}`;
}

/** Loaders of the choices a library supplies for a named domain: `[value, label]` pairs. */
const NAMED = new Map<string, () => Promise<readonly (readonly [Json, string])[]>>();

/** Supply the choices of a named domain (`ComplexBases`), loaded when a declaration first names it. */
export function registerDomain(name: string, load: () => Promise<readonly (readonly [Json, string])[]>): void {
  NAMED.set(name, load);
}

/** Each named domain among `specs` as the choices its library supplies; unknown names stay as they are. */
export async function resolveNamedDomains(specs: readonly VariableSpec[]): Promise<VariableSpec[]> {
  return Promise.all(
    specs.map(async (spec) => {
      if (spec.domain.kind !== "named") return spec;
      const load = NAMED.get(spec.domain.name);
      if (!load) return { ...spec, domain: { kind: "any" } as const };
      const choices = await load();
      return {
        ...spec,
        domain: { kind: "choices", values: choices.map(([v]) => v), labels: choices.map(([, l]) => l) },
      };
    }),
  );
}

export interface VariableSpec {
  /** The name, without its wildcard's `_`. */
  readonly name: string;
  readonly domain: Domain;
  readonly start: Json;
}

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);
/**
 * `Name -> value`: a `Rule` or `KeyValuePair`, or the `Tuple` compute-engine makes of one, which is a
 * rule only when it names something (`(Range, [1, 2])`), never a point (`(-1, 1)`).
 */
const isRule = (json: Json): boolean => {
  const head = headOf(json);
  if (argsOf(json).length !== 2) return false;
  if (head === "Rule" || head === "KeyValuePair") return true;
  const key = argsOf(json)[0];
  return head === "Tuple" && typeof key === "string" && /^[A-Z_]/.test(key);
};
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
  IsPrimePower: (n) => {
    if (n < 2) return false;
    let p = 2;
    while (n % p !== 0) p++;
    let m = n;
    while (m % p === 0) m /= p;
    return m === 1;
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
  // A ring's points, the ring named or another variable's (`_r`).
  if ((typeof json === "string" && json in POINT_RINGS) || (typeof json === "string" && /^_[A-Za-z]\w*$/.test(json)))
    return { kind: "points", ring: json, ...(lo !== undefined && hi !== undefined ? { min: lo, max: hi } : {}) };
  // Any other name is a domain a library supplies.
  if (
    typeof json === "string" &&
    /^[A-Z]\w*$/.test(json) &&
    !["Integers", "Reals", "Booleans", "Automatic"].includes(json)
  )
    return { kind: "named", name: json };
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
    // `Automatic`: no domain of its own, so it is what the start says (a list start is a value, not choices).
    const d =
      domain === "Automatic" && headOf(start) === "List"
        ? ({ kind: "any" } as const)
        : domainOf(domain === "Automatic" ? undefined : domain, start, options);
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

/** Reach of a ring point's coordinates a random draw takes when its declaration gives no `Range`. */
const POINT_REACH = 4;

/**
 * A random value of a variable's domain, other than `current` where it can be: an integer it
 * admits, a real in its range, a choice, a boolean, or a ring point with coordinates in its
 * `Range` (a list of points draws nothing). Undefined when the domain has nothing to draw from.
 */
export function randomValue(spec: VariableSpec, current: Json, random = Math.random): Json {
  const d = spec.domain;
  switch (d.kind) {
    case "integers":
      return randomInteger(d, numberOf(current) ?? 0, random);
    case "reals":
      return d.min + random() * (d.max - d.min);
    case "booleans":
      return current === "True" ? "False" : "True";
    case "choices": {
      const others = d.values.filter((v) => JSON.stringify(v) !== JSON.stringify(current));
      return others.length > 0 ? others[Math.floor(random() * others.length)] : undefined;
    }
    case "points": {
      if (headOf(current) === "List") return undefined;
      const [lo, hi] = [d.min ?? -POINT_REACH, d.max ?? POINT_REACH];
      const draw = (): number => lo + Math.floor(random() * (hi - lo + 1));
      return ["Tuple", draw(), draw()];
    }
  }
  return undefined;
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
