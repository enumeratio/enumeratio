// @enumeratio/braid's heads in traditional notation: braid words as crossings σᵢ, knot and
// link invariants, torus and pretzel presentations. Each head's is data,
// `reference/<Head>/notation.json`, compiled here, but for the braid word below.

import type { Json } from "@enumeratio/engine";
import {
  combineNotation,
  compileNotation,
  type Notation,
  type NotationRule,
  row,
  subscript,
  superscript,
  type PackageNotation,
} from "@enumeratio/boxes";
import { NOTATION_DATA } from "./notation.generated.ts";

/** A literal list of numbers, or `undefined`. */
const numbers = (x: Json | undefined): number[] | undefined => {
  if (!Array.isArray(x) || x[0] !== "List") return undefined;
  const items = (x as readonly unknown[]).slice(1);
  return items.every((e) => typeof e === "number") ? (items as number[]) : undefined;
};

/** `n(1,2,...,3)` a braid word as crossings, a run of one generator written as its power:
 *  σ₁σ₁σ₁ is σ₁³, σ₂⁻¹σ₂⁻¹ is σ₂⁻². */
const braidRule: NotationRule = ([n, word, ...rest]) => {
  const letters = numbers(word);
  if (n === undefined || letters === undefined || rest.length > 0) return undefined;
  if (letters.length === 0) return "1";
  const runs: [number, number][] = [];
  for (const k of letters) {
    const last = runs.at(-1);
    if (last !== undefined && last[0] === k) last[1]++;
    else runs.push([k, 1]);
  }
  return row(
    runs.map(([k, times]) => {
      const power = Math.sign(k) * times;
      const sigma = subscript("σ", String(Math.abs(k)));
      return power === 1 ? sigma : superscript(sigma, String(power));
    }),
  );
};

const DATA = combineNotation(Object.entries(NOTATION_DATA).map(([head, data]) => compileNotation(head, data)));

export const BRAID_NOTATION: Notation = {
  ...DATA.traditional,
  // A run of one generator writes as its power, which a template can't say; and a braid word
  // writes itself even with its crossing list.
  Braid: braidRule,
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: BRAID_NOTATION };
