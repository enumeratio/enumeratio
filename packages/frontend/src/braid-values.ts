// Braid-valued expressions as the braid they name, for the strand frame. A layer's data is held,
// so `TorusBraid(3, 2)` reaches the frame as the call; the braid package's own functions
// (the ones the engine's heads call) expand it, without loading an engine.

import {
  type Braid,
  braidPower,
  compose,
  invert,
  lorenzBraid,
  positivePermutationBraid,
  torusBraid,
} from "@enumeratio/braid/words";
import { argsOf, headOf, intOf, intsOf, type Json, unwrapped } from "./frame-json.ts";

/** The heads that name a braid, besides a literal `Braid(n, word)`. */
export const BRAID_HEADS: readonly string[] = [
  "TorusBraid",
  "BraidInverse",
  "BraidPower",
  "BraidProduct",
  "PositivePermutationBraid",
  "LorenzBraid",
];

const stringOf = (json: Json): string | undefined =>
  typeof json === "string" ? json.replace(/^'([\s\S]*)'$/, "$1") : undefined;

const MAX_WORD = 2000;

const BRAID_USAGE = "Braid needs a strand count and a word: Braid(3, [1, -2]).";

/**
 * The braid a `Braid(n, word)` or braid-valued call names: its strands and word as written (the
 * frame checks the letters), or why it names none. Undefined when the head is not a braid's.
 */
export function braidValueOf(node: Json): Braid | string | undefined {
  const json = unwrapped(node);
  const head = headOf(json);
  const args = argsOf(json);
  if (head === "Braid") {
    const strands = intOf(args[0]);
    const word = args[1] === undefined ? [] : intsOf(args[1]);
    return strands !== undefined && word ? { strands, word } : BRAID_USAGE;
  }
  if (head === undefined || !BRAID_HEADS.includes(head)) return undefined;
  const failed = `${head} does not name a braid here.`;
  /** The braid in argument `k`, or the message that says why not. */
  const inner = (k: number): Braid | string => {
    const b = braidValueOf(args[k]);
    return b ?? `${head} needs a braid.`;
  };
  const [a, b] = [args[0], args[1]];
  switch (head) {
    case "TorusBraid": {
      const [p, q] = [intOf(a), intOf(b)];
      return (p !== undefined && q !== undefined ? torusBraid(p, q) : undefined) ?? failed;
    }
    case "PositivePermutationBraid": {
      const image = intsOf(a);
      return (image ? positivePermutationBraid(image.map((v) => v - 1)) : undefined) ?? failed;
    }
    case "LorenzBraid": {
      const word = stringOf(a);
      return (word !== undefined && /^[LR]+$/.test(word) ? lorenzBraid(word) : undefined) ?? failed;
    }
    case "BraidInverse": {
      const x = inner(0);
      return typeof x === "string" ? x : invert(x);
    }
    case "BraidPower": {
      const [x, k] = [inner(0), intOf(b)];
      if (typeof x === "string") return x;
      // A power the frame would refuse to draw is not worth building.
      if (k === undefined || x.word.length * Math.abs(k) > MAX_WORD) return failed;
      return braidPower(x, k) ?? failed;
    }
    default: {
      const [x, y] = [inner(0), inner(1)];
      if (typeof x === "string") return x;
      if (typeof y === "string") return y;
      return compose(x, y) ?? "BraidProduct needs braids on the same number of strands.";
    }
  }
}
