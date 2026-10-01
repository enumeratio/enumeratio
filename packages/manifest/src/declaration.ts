// What compute-engine is handed for a definition: its signature, its body, and what its
// attributes and defaults make of them. Shared by the resolver and a library's generated
// JavaScript entry, which inlines `declarationOf`'s source (`library-entry.ts`), so it imports
// nothing and uses no names from outside itself.
//
// Options are compute-engine's own named arguments: optional parameters, named in the
// signature (`(x: number, factor: number?) -> number`), which a call gives by name
// (`Scaled(3, factor: 5)`), so they are per signature. compute-engine has no defaults, so a
// definition states them, and a call that leaves an optional parameter out gets its default.

/** A Wolfram-style attribute a definition may carry; `HoldAll` is compute-engine's `lazy`. */
export type DefinitionAttribute = "HoldAll";

/** The parts of a definition that shape its declaration. */
export interface Declarable {
  readonly signature: string;
  readonly attributes?: readonly DefinitionAttribute[];
  /** The value of each optional parameter a call leaves out, by name: the body's last parameters. */
  readonly defaults?: Readonly<Record<string, unknown>>;
}

/**
 * The declaration for a definition whose body (a `Function`, pins resolved) is `body`. With
 * `HoldAll`, a call's arguments are put into the body as written: compute-engine evaluates a
 * `Function`'s arguments when it applies one, even for a `lazy` head.
 */
export function declarationOf(definition: Declarable, body: unknown): Record<string, unknown> {
  const held = definition.attributes?.includes("HoldAll") === true;
  const defaults = definition.defaults ?? {};
  const params = Array.isArray(body) && body[0] === "Function" ? (body.slice(2) as unknown[]) : [];
  if (!held && Object.keys(defaults).length === 0) return { signature: definition.signature, evaluate: body };
  /** `json` with each parameter `values` has replaced, except where an inner `Function` rebinds it. */
  const substitute = (json: unknown, values: ReadonlyMap<unknown, unknown>): unknown => {
    if (typeof json === "string") return values.has(json) ? values.get(json) : json;
    if (!Array.isArray(json)) return json;
    if (json[0] === "Function") {
      const inner = new Map([...values].filter(([name]) => !json.slice(2).includes(name)));
      return ["Function", substitute(json[1], inner), ...json.slice(2)];
    }
    return json.map((item) => substitute(item, values));
  };
  return {
    signature: definition.signature,
    ...(held ? { lazy: true } : {}),
    evaluate: (
      ops: readonly { readonly json: unknown }[],
      { engine }: { engine: { box(json: unknown): { evaluate(): unknown } } },
    ) => {
      const missing = params.slice(ops.length).map((name) => defaults[name as string]);
      // A required parameter left out is compute-engine's to report, not a default's to fill.
      if (missing.some((value) => value === undefined)) return undefined;
      const args = [...ops.map((op) => op.json), ...missing];
      if (!held) return engine.box(["Apply", body, ...args]).evaluate();
      return engine.box(substitute((body as unknown[])[1], new Map(params.map((p, i) => [p, args[i]])))).evaluate();
    },
  };
}
