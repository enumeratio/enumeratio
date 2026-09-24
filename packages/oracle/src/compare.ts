// Deciding whether an external system agrees with us.
//
// Values arrive as strings from four systems with four print conventions, so comparison is
// deliberately forgiving about spelling and strict about value. A numeric answer matches
// within a relative tolerance; anything else has to match after normalising whitespace,
// brackets and the several ways these systems spell a list.

import { compareTrees, type Tree } from "./structural.ts";

/** A number if the text denotes one — including Python complex and Wolfram real syntax. */
export function asNumber(text: string): number | undefined {
  const cleaned = text
    .trim()
    .replace(/\*\^/g, "e")
    .replace(/`+[0-9.]*/g, "");
  if (!/^[-+]?[0-9.]+([eE][-+]?\d+)?$/.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/** Strip the differences that are only notation: brackets, spaces, trailing zeros. */
export const normalise = (text: string): string =>
  text
    .trim()
    .replace(/\s+/g, "")
    .replace(/[{[]/g, "[")
    .replace(/[}\]]/g, "]")
    .replace(/\.0+\b/g, "")
    .toLowerCase();

export type Verdict = "agree" | "disagree" | "inconclusive";

/** Compare an oracle's printed value against ours. */
export function compare(ours: string, theirs: string, tolerance = 1e-9): Verdict {
  if (theirs === "" || /^(none|null|\$failed|indeterminate)$/i.test(theirs.trim())) {
    return "inconclusive";
  }
  const [a, b] = [asNumber(ours), asNumber(theirs)];
  if (a !== undefined && b !== undefined) {
    const scale = Math.max(1, Math.abs(a), Math.abs(b));
    return Math.abs(a - b) <= tolerance * scale ? "agree" : "disagree";
  }
  // A symbolic answer from SymPy or Sage against our numeric one proves nothing either way.
  if ((a === undefined) !== (b === undefined)) return "inconclusive";
  return normalise(ours) === normalise(theirs) ? "agree" : "disagree";
}

/** A Python literal — nested lists/tuples of numbers and booleans — parsed into a `Tree`
 * (structural.ts), or `undefined` if `text` isn't one. Tuples and lists both become plain
 * arrays: Sage's `[(2, 2), (3, 1)]` (a list of tuples, from `list(factor(n))`) lines up
 * element-wise against our `[["Tuple",2,2],["Tuple",3,1]]` once both are just arrays. */
export function parsePython(text: string): Tree | undefined {
  const s = text.trim();
  let i = 0;
  const FAIL = Symbol("fail");
  const skipSpace = (): void => {
    while (i < s.length && /\s/.test(s[i] as string)) i++;
  };
  const parseValue = (): Tree | typeof FAIL => {
    skipSpace();
    const open = s[i];
    if (open === "[" || open === "(") {
      const close = open === "[" ? "]" : ")";
      i++;
      const items: Tree[] = [];
      skipSpace();
      if (s[i] === close) {
        i++;
        return items;
      }
      for (;;) {
        const item = parseValue();
        if (item === FAIL) return FAIL;
        items.push(item);
        skipSpace();
        if (s[i] === ",") {
          i++;
          skipSpace();
          if (s[i] === close) {
            i++;
            break;
          }
          continue;
        }
        if (s[i] === close) {
          i++;
          break;
        }
        return FAIL;
      }
      return items;
    }
    if (s.startsWith("True", i)) {
      i += 4;
      return true;
    }
    if (s.startsWith("False", i)) {
      i += 5;
      return false;
    }
    const match = /^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(i));
    if (match !== null) {
      i += match[0].length;
      return Number(match[0]);
    }
    return FAIL;
  };
  const result = parseValue();
  skipSpace();
  return result === FAIL || i !== s.length ? undefined : (result as Tree);
}

/** `compare`, but for a Python-family system's answer against our reduced tree, when a
 * shape difference (a tuple where we have a list) is the only thing text comparison would
 * catch as a false disagreement. `undefined` when `theirs` doesn't parse as a literal. */
export function comparePythonStructured(
  ours: Tree,
  theirs: string,
  tolerance = 1e-9,
): Verdict | undefined {
  const theirsTree = parsePython(theirs);
  return theirsTree === undefined ? undefined : compareTrees(ours, theirsTree, tolerance);
}
