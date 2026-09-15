// Deciding whether an external system agrees with us.
//
// Values arrive as strings from four systems with four print conventions, so comparison is
// deliberately forgiving about spelling and strict about value. A numeric answer matches
// within a relative tolerance; anything else has to match after normalising whitespace,
// brackets and the several ways these systems spell a list.

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
