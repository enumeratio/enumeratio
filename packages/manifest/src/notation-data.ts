// A head's notation as data: what a library publishes beside a definition
// (`reference/<Name>/notation.json`), with no code in it. TraditionalForm is box templates,
// StandardForm LaTeX entries compute-engine reads and writes from their kind and precedence
// alone. It names no head, so it follows its definition to whatever head that's declared as.
// `@enumeratio/boxes`' `compileNotation` makes it a package notation; this is its shape and
// its check, here so packing and the resolver don't need boxes.

/** One way to write a call, for calls with exactly as many arguments as it has `params`. */
export interface BoxTemplate {
  readonly params: readonly string[];
  /** The whole call's boxes, a `TemplateSlot` for each param (`{ Tight: true }` fences a base). */
  readonly box?: unknown;
  /** The name of a call written `name(args…)`, its arguments the params `call` doesn't use. */
  readonly call?: unknown;
  /** A literal list argument writes it as a call (`Fibonacci([1, 2])`, not `F_[1,2]`); default true. */
  readonly scalars?: boolean;
}

/** A LaTeX trigger, read and written by compute-engine from its kind and precedence alone. */
export interface LatexData {
  readonly trigger: string;
  readonly kind?: "function" | "symbol" | "prefix" | "postfix" | "infix" | "expression";
  readonly precedence?: number;
}

/** One head's notation, as data. */
export interface NotationData {
  /** Tried in order; the first whose arity matches writes the call. */
  readonly traditional?: readonly BoxTemplate[];
  readonly latex?: readonly LatexData[];
}

/** The params a template's box uses, by name. */
export function slotsOf(box: unknown, into: Set<string> = new Set()): Set<string> {
  if (!Array.isArray(box)) return into;
  if (box[0] === "TemplateSlot" && typeof box[1] === "string") into.add(box[1]);
  else for (const item of box) slotsOf(item, into);
  return into;
}

/** Why `data` can't be compiled, or undefined: a template gives a box or a call over its own params. */
export function notationProblem(data: NotationData): string | undefined {
  for (const t of data.traditional ?? []) {
    if ((t.box === undefined) === (t.call === undefined)) return "a template has one of box and call";
    const unknown = [...slotsOf(t.box ?? t.call)].filter((s) => !t.params.includes(s));
    if (unknown.length > 0) return `a template uses ${unknown.join(", ")}, which aren't among its params`;
  }
  for (const e of data.latex ?? [])
    if (typeof e.trigger !== "string" || e.trigger === "") return "a LaTeX entry has no trigger";
  return undefined;
}
