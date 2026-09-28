// Every head that gets a `notatio-<head>` tag: every head the manifest knows (the engine's
// own and every record's, design/manifest.md), the heads that draw, and the leaf tags of
// the structural tree (design/vdom.md §1).

import { GRAPHICS_HEADS } from "@enumeratio/formats";
import { SYMBOLS } from "@enumeratio/manifest";

const ATOMS = ["Integer", "Real", "Rational", "Complex", "String", "Symbol"];

// A tag needs a name that survives kebab-casing: letters and digits, starting with a letter.
const taggable = (name: string): boolean => /^[A-Za-z][A-Za-z0-9]*$/.test(name);

export const HEADS: readonly string[] = [...new Set([...Object.keys(SYMBOLS), ...GRAPHICS_HEADS, ...ATOMS])]
  .filter(taggable)
  .sort();

/**
 * The parameter names of the heads of fixed arity, from the reference signatures --
 * what `<notatio-set-minus a="…" b="…">` spells by name.
 */
export const PARAMS: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  Object.values(SYMBOLS).flatMap((s) => (s.params !== undefined ? [[s.name, s.params]] : [])),
);
