// Deciding whether an external system agrees with us.
//
// Values arrive as strings from four systems with four print conventions, so comparison is
// deliberately forgiving about spelling and strict about value. A numeric answer matches
// within a relative tolerance; anything else has to match after normalising whitespace,
// brackets and the several ways these systems spell a list.

import type { MathJSON } from "./emit.ts";
import { compareTrees, type Tree } from "./structural.ts";

/** A number if the text denotes one — including Python complex and Wolfram real syntax, and
 * an exact rational as SymPy and Lean (`p/q`) or Julia (`p//q`) print it. */
export function asNumber(text: string): number | undefined {
  const ratio = /^\s*([-+]?\d+)\s*\/\/?\s*(\d+)\s*$/.exec(text);
  if (ratio !== null && Number(ratio[2]) !== 0) return Number(ratio[1]) / Number(ratio[2]);
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
    // A Python complex, `(1.5+2j)` or `2j`, as the {re, im} leaf ours reduces to.
    const complex =
      /^\(\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*([-+])\s*([\d.]+(?:e[-+]?\d+)?)j\s*\)|^([-+]?[\d.]+(?:e[-+]?\d+)?)j/i.exec(
        s.slice(i),
      );
    if (complex !== null) {
      i += complex[0].length;
      if (complex[4] !== undefined) return { re: 0, im: Number(complex[4]) };
      const im = Number(complex[3]) * (complex[2] === "-" ? -1 : 1);
      return { re: Number(complex[1]), im };
    }
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
export function comparePythonStructured(ours: Tree, theirs: string, tolerance = 1e-9): Verdict | undefined {
  const theirsTree = parsePython(theirs);
  return theirsTree === undefined ? undefined : compareTrees(ours, theirsTree, tolerance);
}

/** A diagram's blocks, `["List", ["List", 1, 2], …]`, as `{{-2,-1},{1,2}}`: each block
 * ascending, blocks in order — the form the Sage helpers print. */
function blocksLabel(label: MathJSON): string | undefined {
  if (!Array.isArray(label) || label[0] !== "List") return undefined;
  const blocks: number[][] = [];
  for (const block of label.slice(1) as MathJSON[]) {
    if (!Array.isArray(block) || block[0] !== "List") return undefined;
    const points = block.slice(1) as MathJSON[];
    if (!points.every((p): p is number => typeof p === "number")) return undefined;
    blocks.push([...points].sort((a, b) => a - b));
  }
  blocks.sort((a, b) => {
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return a.length - b.length;
  });
  return `{${blocks.map((b) => `{${b.join(",")}}`).join(",")}}`;
}

/** A basis label as MathJSON writes it: `'3'`, the evaluated `'"s0"'`, `["String", "s0"]`,
 * or a diagram's list of blocks. */
function basisLabel(label: MathJSON): string | undefined {
  if (Array.isArray(label)) {
    if (label[0] === "String" && typeof label[1] === "string") return label[1] as string;
    return blocksLabel(label);
  }
  if (typeof label !== "string" || !/^'.*'$/s.test(label)) return undefined;
  const inner = label.slice(1, -1);
  return /^".*"$/s.test(inner) ? (JSON.parse(inner) as string) : inner;
}

/** A symbolic scalar factor — `delta`, `["Power", "delta", 2]` — as [symbol, exponent]. */
function symbolPower(e: MathJSON): [string, number] | undefined {
  if (typeof e === "string" && !/^'.*'$/s.test(e)) return [e, 1];
  if (Array.isArray(e) && e[0] === "Power" && typeof e[1] === "string" && typeof e[2] === "number") return [e[1], e[2]];
  return undefined;
}

/** `*delta^2` for a coefficient's symbolic part, empty when it has none. */
function monomialOf(powers: readonly [string, number][]): string {
  const by = new Map<string, number>();
  for (const [symbol, n] of powers) by.set(symbol, (by.get(symbol) ?? 0) + n);
  return [...by]
    .filter(([, n]) => n !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([symbol, n]) => `*${symbol}^${n}`)
    .join("");
}

/**
 * An algebra element as `Head(label)*symbol^k → coefficient`, from sums, scalar multiples
 * (numbers, and symbols like the loop parameter `delta`) and negations of one-argument
 * basis calls (`["GroupBasis", "'1'"]`, a `Diagram`). `undefined` for anything else — a
 * basis element times a basis element, say.
 */
export function linearCombination(expr: MathJSON): Map<string, number> | undefined {
  const out = new Map<string, number>();
  const add = (e: MathJSON, factor: number, monomial: readonly [string, number][]): boolean => {
    if (!Array.isArray(e) || typeof e[0] !== "string") return false;
    const [head, ...ops] = e as readonly MathJSON[];
    if (head === "Add") return ops.every((op) => add(op, factor, monomial));
    if (head === "Negate" && ops.length === 1) return add(ops[0] as MathJSON, -factor, monomial);
    if (head === "Multiply") {
      const scalars = ops.filter((op): op is number => typeof op === "number");
      const powers = ops.map(symbolPower).filter((p) => p !== undefined);
      const rest = ops.filter((op) => typeof op !== "number" && symbolPower(op) === undefined);
      if (rest.length !== 1) return false;
      const product = scalars.reduce((a, b) => a * b, factor);
      return add(rest[0] as MathJSON, product, [...monomial, ...powers]);
    }
    const label = ops.length === 1 ? basisLabel(ops[0] as MathJSON) : undefined;
    if (label === undefined) return false;
    const key = `${head as string}(${label})${monomialOf(monomial)}`;
    out.set(key, (out.get(key) ?? 0) + factor);
    return true;
  };
  if (!add(expr, 1, [])) return undefined;
  for (const [key, c] of out) if (c === 0) out.delete(key);
  return out;
}

/** Ours against an answer printed as `combination:{"GroupBasis(1)": 2, …}`: equal as maps,
 * whatever order either side wrote its terms in. */
export function compareCombination(ours: MathJSON, theirs: string): Verdict {
  const mine = linearCombination(ours);
  if (mine === undefined) return "inconclusive";
  const parsed = JSON.parse(theirs.slice("combination:".length)) as Record<string, number>;
  const keys = new Set([...mine.keys(), ...Object.keys(parsed)]);
  for (const key of keys) if ((mine.get(key) ?? 0) !== (parsed[key] ?? 0)) return "disagree";
  return "agree";
}

/** Ours, a `List` of elements, against `combinations:[{…}, …]` — compared as a set of
 * elements, since a basis's order is a convention of each system. */
export function compareCombinations(ours: MathJSON, theirs: string): Verdict {
  if (!Array.isArray(ours) || ours[0] !== "List") return "inconclusive";
  const mine = (ours.slice(1) as MathJSON[]).map(linearCombination);
  if (mine.some((m) => m === undefined)) return "inconclusive";
  const canon = (m: Record<string, number>): string =>
    JSON.stringify(
      Object.entries(m)
        .filter(([, c]) => c !== 0)
        .sort(([x], [y]) => x.localeCompare(y)),
    );
  const parsed = JSON.parse(theirs.slice("combinations:".length)) as Record<string, number>[];
  const byText = (x: string, y: string): number => x.localeCompare(y);
  const a = mine.map((m) => canon(Object.fromEntries(m!))).sort(byText);
  const b = parsed.map(canon).sort(byText);
  return JSON.stringify(a) === JSON.stringify(b) ? "agree" : "disagree";
}
