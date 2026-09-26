// A definition is keyed by SIGNATURE, not by name.
//
// `MajorIndex` on a permutation and `MajorIndex` on a Dyck path are the same name and
// genuinely different functions; `Peaks` and `Valleys` are the same story. The catalog
// census made this concrete — 242 stat names over 1051 (collection, stat) rows, 53 of the
// names defined on more than one carrier — and it is the reason the unit here is (head,
// carrier) rather than head. Signatures are where the overloads live, so signatures are
// what carries a definition.

/**
 * A MathJSON expression, structurally. Declared here rather than imported from
 * `@enumeratio/entry`: that package is src-only, and a bundled package that reaches into
 * it for a type cannot have its declarations generated (the same reason collections keeps
 * its reference entries out of the runtime build). A definitions package should not depend
 * on the documentation package for a JSON shape anyway.
 */
export type MathJSON = string | number | boolean | readonly MathJSON[] | { readonly [key: string]: unknown };

/** The wildcard every definition binds its argument to. */
export const SUBJECT = "_x";

/** One (head, carrier) pair, defined as an expression over `_x`. */
export interface Definition {
  readonly head: string;
  /** The carrier this definition is for — `Permutations`, `IntegerPartitions`, … */
  readonly on: string;
  /** The defining expression, over `_x`. Evaluable: this IS the implementation. */
  readonly expr: MathJSON;
  /** What the statistic counts or measures, in one line. */
  readonly summary: string;
  /** A convention worth pinning — an indexing base, an edge case, a competing definition. */
  readonly note?: string;
  /**
   * This reading is ALSO meaningful on a bare list of integers, so the head accepts one
   * alongside its carrier. True only where the definition compares entries with each OTHER;
   * a statistic that reads a value against its position, or walks the orbits, needs the
   * bijection and takes the carrier alone.
   */
  readonly alsoOnList?: boolean;
}

/** `head` at `carrier`, the key a signature-addressed lookup uses. */
export const signatureOf = (definition: Definition): string => `${definition.head}@${definition.on}`;

/** Index definitions by signature. Two definitions of one signature is a bug, not an overload. */
export function bySignature(definitions: readonly Definition[]): Map<string, Definition> {
  const index = new Map<string, Definition>();
  for (const definition of definitions) {
    const key = signatureOf(definition);
    if (index.has(key)) throw new Error(`duplicate definition for ${key}`);
    index.set(key, definition);
  }
  return index;
}

/** Every head that appears in `expr`, in order of first appearance. */
export function headsOf(expr: MathJSON): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    const [head, ...rest] = node;
    if (typeof head === "string" && !seen.has(head)) {
      seen.add(head);
      found.push(head);
    }
    for (const operand of rest) walk(operand);
  };
  walk(expr);
  return found;
}
