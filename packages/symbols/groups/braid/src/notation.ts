// @enumeratio/braid's heads in traditional notation: braid words as crossings σᵢ, knot and
// link invariants, torus and pretzel presentations.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  fence,
  named,
  type Notation,
  type NotationRule,
  row,
  scalars,
  subscript,
  superscript,
  type PackageNotation,
} from "@enumeratio/boxes";

/** A literal list of numbers, or `undefined`. */
const numbers = (x: MathJsonExpression | undefined): number[] | undefined => {
  if (!Array.isArray(x) || x[0] !== "List") return undefined;
  const items = (x as readonly unknown[]).slice(1);
  return items.every((e) => typeof e === "number") ? (items as number[]) : undefined;
};

/** A knot invariant of `K` in `t`: `symbol_{K}(t)`. */
const invariant =
  (symbol: Box): NotationRule =>
  ([k, ...rest], write) =>
    k === undefined || rest.length > 0 ? undefined : write.call(subscript(symbol, write.box(k)), ["t"]);

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

export const BRAID_NOTATION: Notation = {
  // A braid word writes itself even with its crossing list, `listArgument`.
  Braid: braidRule,
  BraidPower: scalars(([b, k, ...rest], write) =>
    b === undefined || k === undefined || rest.length > 0
      ? undefined
      : superscript(fence("(", [write.box(b)], ")"), write.box(k)),
  ),
  TorusBraid: scalars(([p, q, ...rest], write) =>
    p === undefined || q === undefined || rest.length > 0
      ? undefined
      : subscript("T", row([write.box(p), ",", write.box(q)])),
  ),
  PretzelKnot: scalars((args, write) => (args.length < 1 ? undefined : write.call("P", args))),
  AlexanderPolynomial: scalars(invariant("Δ")),
  JonesPolynomial: scalars(invariant("V")),
  KauffmanBracket: scalars(([k, ...rest], write) =>
    k === undefined || rest.length > 0 ? undefined : fence("⟨", [write.box(k)], "⟩"),
  ),
  SeifertGenus: scalars(named("g", 1)),
  BraidWrithe: scalars(named("w", 1)),
};

/** This package's notation, which a host loads before it builds an engine. */
export const notation: PackageNotation = { traditional: BRAID_NOTATION };
