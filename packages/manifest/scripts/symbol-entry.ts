// A symbol package's JavaScript entry, generated at pack time from its Epsil
// (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.2), so the package works as a plain
// library too. The Epsil stays the only source: this is derived from it, never edited.
//
//   - `declare(ce)` declares every definition into a compute-engine, under the heads the
//     registry would give them, after the packages its pins point into (imported by name);
//   - each definition compute-engine compiles to self-contained JavaScript is also exported
//     as a plain function, checked against its examples here. Compiled code that needs
//     compute-engine's runtime (`_SYS`: special functions, list broadcasting) isn't exported,
//     since that runtime isn't public.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { compile } from "@cortex-js/compute-engine/compile";
import type { SymbolIndex } from "../src/npm-registry.ts";
import { type Definition, type Example, pinnedHead, qualifiedNamesOf, withHeads } from "../src/registry.ts";

export interface EntryInput {
  readonly index: SymbolIndex;
  readonly definitions: Readonly<Record<string, Definition>>;
  /** Which package serves each namespace this package's pins point into. */
  readonly packages: Readonly<Record<string, string>>;
}

export interface Entry {
  readonly js: string;
  readonly dts: string;
  /** The definitions exported as plain functions. */
  readonly functions: readonly string[];
}

/** Each definition's head and its body with every qualified name replaced by the head it means. */
function lowered(input: EntryInput): Map<string, { head: string; signature: string; body: unknown }> {
  const { index, definitions } = input;
  const out = new Map<string, { head: string; signature: string; body: unknown }>();
  for (const [name, entry] of Object.entries(index.symbols)) {
    const { signature, body, requires = {} } = definitions[name]!;
    const heads = new Map<string, string>();
    for (const used of qualifiedNamesOf(body)) {
      const [namespace, member] = used.split(".") as [string, string];
      const pin = requires[used];
      // A system name is its head; anything else is pinned.
      heads.set(used, pin === undefined ? member : pinnedHead(namespace, member, pin));
    }
    out.set(name, { head: pinnedHead(index.namespace, name, entry.pin), signature, body: withHeads(body, heads) });
  }
  return out;
}

/** Definitions in an order that declares what each uses of this package before it. */
function declareOrder(input: EntryInput): string[] {
  const { index } = input;
  const ordered: string[] = [];
  const visit = (name: string, seen: Set<string>): void => {
    if (ordered.includes(name) || seen.has(name)) return;
    seen.add(name);
    for (const used of Object.keys(index.symbols[name]!.requires ?? {})) {
      const [namespace, member] = used.split(".") as [string, string];
      if (namespace === index.namespace && member in index.symbols) visit(member, seen);
    }
    ordered.push(name);
  };
  for (const name of Object.keys(index.symbols).toSorted()) visit(name, new Set());
  return ordered;
}

/** `(number, integer) -> number` as a TypeScript function type, where every part is numeric. */
function tsType(signature: string): string {
  const match = /^\((.*)\)\s*->\s*(.+)$/.exec(signature.trim());
  const numeric = (t: string): boolean => /^(number|integer|real|rational|finite_number|finite_real)$/.test(t.trim());
  if (match === null) return "(...args: unknown[]) => unknown";
  const params = match[1]!.trim() === "" ? [] : match[1]!.split(",");
  if (!params.every(numeric) || !numeric(match[2]!)) return "(...args: unknown[]) => unknown";
  return `(${params.map((_, i) => `x${i}: number`).join(", ")}) => number`;
}

/** Whether a compiled function meets every numeric example it can be asked about. */
function meetsExamples(
  fn: (...args: number[]) => unknown,
  member: string,
  namespace: string,
  examples: readonly Example[],
) {
  for (const { expr, expected, tolerance = 0 } of examples) {
    if (!Array.isArray(expr) || expr[0] !== "MemberCall" || expr[1] !== namespace || expr[2] !== `'${member}'`)
      continue;
    const args = expr.slice(3);
    if (!args.every((a) => typeof a === "number") || typeof expected !== "number") continue;
    const got = fn(...(args as number[]));
    if (typeof got !== "number" || Math.abs(got - expected) > tolerance * Math.max(1, Math.abs(expected))) return false;
  }
  return true;
}

/** The entry's source: `index.js` and `index.d.ts`. */
export async function entryOf(input: EntryInput): Promise<Entry> {
  const { index, definitions, packages } = input;
  const heads = lowered(input);
  const ce = new ComputeEngine();
  for (const name of declareOrder(input)) {
    const { head, signature, body } = heads.get(name)!;
    ce.declare(head, { signature, evaluate: body } as never);
  }

  const functions: string[] = [];
  const compiled: string[] = [];
  const dtsFunctions: string[] = [];
  for (const name of Object.keys(index.symbols).toSorted()) {
    const { body, signature } = heads.get(name)!;
    let code: string | undefined;
    try {
      const result = compile(ce.box(body as never) as never) as { success: boolean; code: string };
      if (result.success && !/\b_SYS\b|\b_\./.test(result.code)) code = result.code;
    } catch {
      code = undefined;
    }
    if (code === undefined) continue;
    // Load the code as a module, as the entry will: the example check runs what ships.
    const source = `export default ${code};`;
    const loaded = (await import(`data:text/javascript,${encodeURIComponent(source)}`)) as {
      default: (...args: number[]) => unknown;
    };
    const fn = loaded.default;
    if (!meetsExamples(fn, name, index.namespace, definitions[name]!.examples ?? [])) continue;
    functions.push(name);
    compiled.push(`/** ${index.namespace}.${name}, compiled from its Epsil. */\nexport const ${name} = ${code};`);
    dtsFunctions.push(`export declare const ${name}: ${tsType(signature)};`);
  }

  const imports = new Map<string, string>();
  for (const name of Object.keys(index.symbols))
    for (const used of Object.keys(index.symbols[name]!.requires ?? {})) {
      const namespace = used.split(".")[0]!;
      if (namespace === index.namespace) continue;
      const pkg = packages[namespace];
      if (pkg === undefined)
        throw new Error(`${index.namespace}.${name} pins ${used}, and no dependency serves ${namespace}`);
      imports.set(namespace, pkg);
    }
  const importLines = [...imports].map(
    ([, pkg], i) => `import { declare as declare${i} } from ${JSON.stringify(pkg)};`,
  );
  const dependencyCalls = [...imports.keys()].map((_ns, i) => `  declare${i}(ce);`);
  const definitionData = Object.fromEntries(
    declareOrder(input).map((name) => {
      const { head, signature, body } = heads.get(name)!;
      return [name, { head, signature, body }];
    }),
  );

  const js = `// GENERATED by pack-symbols from symbols/ -- do not edit.
${importLines.join("\n")}${importLines.length > 0 ? "\n" : ""}
export const namespace = ${JSON.stringify(index.namespace)};

/** Each definition, by name: the head it's declared as, its signature, its body with pins resolved. */
export const definitions = ${JSON.stringify(definitionData, null, 2)};

// Which members each engine's namespace records hold, shared with every generated entry.
const records = (globalThis[Symbol.for("enumeratio.namespaces")] ??= new WeakMap());

/** Declare every definition into a compute-engine, after the packages its pins point into. */
export function declare(ce) {
${dependencyCalls.join("\n")}${dependencyCalls.length > 0 ? "\n" : ""}  for (const { head, signature, body } of Object.values(definitions))
    if (ce.lookupDefinition(head) === undefined) ce.declare(head, { signature, evaluate: body });
  const spaces = records.get(ce) ?? new Map();
  records.set(ce, spaces);
  const fresh = !spaces.has(namespace);
  const members = spaces.get(namespace) ?? new Map();
  for (const [name, { head }] of Object.entries(definitions)) members.set(name, head);
  spaces.set(namespace, members);
  const value = ["Dictionary", ...[...members].map(([m, h]) => ["Tuple", \`'\${m}'\`, h])];
  if (fresh) ce.declare(namespace, { type: "dictionary<function>", value });
  else ce.assign(namespace, value);
}
${compiled.length > 0 ? `\n${compiled.join("\n\n")}\n` : ""}`;

  const dts = `// GENERATED by pack-symbols from symbols/ -- do not edit.
export declare const namespace: string;
export declare const definitions: Readonly<Record<string, { head: string; signature: string; body: unknown }>>;
/** Declare every definition into a compute-engine, after the packages its pins point into. */
export declare function declare(ce: {
  declare(name: string, definition: object): unknown;
  assign(name: string, value: unknown): unknown;
  lookupDefinition(name: string): unknown;
}): void;
${dtsFunctions.join("\n")}${dtsFunctions.length > 0 ? "\n" : ""}`;

  return { js, dts, functions };
}
