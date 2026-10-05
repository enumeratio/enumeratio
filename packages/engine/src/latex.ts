import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import type { Json } from "./facade.ts";

// The LaTeX hook: how a library says how its heads read and write, without importing
// compute-engine's `/latex-syntax` types. A `LatexRule` is a `LatexDictionaryEntry` narrowed to
// what libraries use; `latexEntries` is the one place it becomes compute-engine's own.

/** What a rule's `parse` may call on compute-engine's parser. */
export interface LatexReader {
  /** The `{…}` group at the cursor, or null if there is none. */
  parseGroup(): Json | null;
  /** The next single token, as an expression. */
  parseToken(): Json | null;
  /** A call's arguments, `(a, b)` for `"enclosure"`; null if there are none. */
  parseArguments(kind?: "implicit" | "enclosure"): readonly Json[] | null;
}

/** What a rule's `serialize` may call on compute-engine's serializer. */
export interface LatexWriter {
  serialize(expr: Json | null | undefined): string;
  /** `expr`, fenced if it binds looser than `precedence`. */
  wrap(expr: Json | null | undefined, precedence?: number): string;
  /** `expr`, fenced unless it is one token. */
  wrapShort(expr: Json | null | undefined): string;
  /** `expr` written as a call, `name(args)`. */
  serializeFunction(expr: Json): string;
}

interface Rule {
  /** The head this rule writes, and reads into. */
  name?: string;
  /** The command or tokens that introduce it, e.g. `"\\permutation"`. */
  latexTrigger?: string | string[];
  /** Write `expr`, an application of `name`. */
  serialize?: (writer: LatexWriter, expr: Json) => string;
}

/** `lhs \trigger rhs`: `parse` gets the left operand and reads the right from the cursor. */
interface InfixRule extends Rule {
  kind: "infix";
  precedence?: number;
  parse?: (reader: LatexReader, lhs: Json) => Json | null;
}

/** `\trigger(args)`: `parse` reads from just after the trigger. */
interface FunctionRule extends Rule {
  kind: "function";
  parse?: (reader: LatexReader) => Json | null;
}

/** A rule that only changes how a head is written. */
interface WriteRule extends Rule {
  kind?: undefined;
  parse?: undefined;
}

/** One LaTeX parse and serialise rule for a head. */
export type LatexRule = InfixRule | FunctionRule | WriteRule;

/** `rules` as compute-engine's dictionary entries, for a host that builds an engine's LaTeX
 *  syntax. The assignment is the check that a rule is still one. */
export const latexEntries = (rules: readonly LatexRule[]): Partial<LatexDictionaryEntry>[] => [...rules];
