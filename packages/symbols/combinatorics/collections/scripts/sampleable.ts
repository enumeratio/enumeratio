// A family's Plausible instance, derived from what it declares (design/plausible.md §3): the
// proxy is the ADDRESS — params plus a rank in that fiber — `interp` is `unrank`, and shrinking
// works on the address, so no family writes a sampler or a shrinker of its own.
//
// A parameterised family is Σ p, Family(p): draw the params at the current size, then a rank
// inside the fiber. What a draw may cost comes from the declared cost classes; an empty or
// too-expensive draw is a DISCARD (Plausible's gaveUp), never a failure.

import { between, randomBelow, type Rng } from "@enumeratio/plausible";
import type { Declared, FamilyKernel } from "../src/families/types.ts";

export interface Address {
  readonly params: number[];
  readonly rank: bigint;
}

export type Draw = { readonly address: Address } | { readonly discard: string };

export interface Sampleable {
  readonly family: FamilyKernel;
  /** Undefined while the family is on the contract test's ratchet: sampled conservatively. */
  readonly declared: Declared | undefined;
  draw(rng: Rng, size: number, budget: bigint): Draw;
  /** Smaller addresses, most aggressive first: params toward their minimum, then rank toward 0. */
  shrink(address: Address): Address[];
  /** The address as it prints in a finding: `Head(4, 2)#17`. */
  show(address: Address): string;
}

/** Undeclared families: every param an axis from 0, and at most this size. */
const UNDECLARED_SIZE = 4;

/** A kernel still in plain numbers declining past 2^53 (see `numberKernel`). */
export const needsBigint = (error: unknown): boolean =>
  error instanceof RangeError && error.message.includes("not bigint yet");

const enumerates = (declared: Declared): boolean => Object.values(declared.cost).some((cost) => cost === "enumerative");

/** "Deriving": the family's instance, or why it can't have one. */
export function sampleable(family: FamilyKernel): Sampleable | { readonly untestable: string } {
  const declared = family.declared;
  if (declared !== undefined) {
    if (declared.params.length !== family.paramCount) {
      return { untestable: `declares ${declared.params.length} params, takes ${family.paramCount}` };
    }
    if (enumerates(declared) && declared.work === undefined) {
      return { untestable: "an enumerative cost without a work bound" };
    }
  }

  const drawParams = (rng: Rng, size: number): number[] => {
    if (declared === undefined) {
      return Array.from({ length: family.paramCount }, () => between(rng, 0, Math.min(size, UNDECLARED_SIZE)));
    }
    return declared.params.map(({ role, min, max }) => {
      const hi = role === "axis" ? min + size : min + 3;
      return between(rng, min, max === undefined ? hi : Math.min(hi, max));
    });
  };

  // Elements the kernels will generate at p. Undeclared families are assumed to enumerate.
  const work = (p: number[], count: bigint): bigint =>
    declared === undefined ? count : declared.work !== undefined && enumerates(declared) ? declared.work(p) : 0n;

  const draw = (rng: Rng, size: number, budget: bigint): Draw => {
    const params = drawParams(rng, size);
    // A count that itself enumerates must not run before its bound says it can afford to.
    if (declared?.cost.count === "enumerative" && (declared.work as (p: number[]) => bigint)(params) > budget) {
      return { discard: "over budget" };
    }
    let count: bigint | number;
    try {
      count = family.count(params);
    } catch (error) {
      if (needsBigint(error)) return { discard: "past 2^53, kernel not bigint yet" };
      throw error;
    }
    if (typeof count === "bigint") {
      if (count <= 0n) return { discard: "empty" };
      if (work(params, count) > budget) return { discard: "over budget" };
      // The ends of a fiber are where the bugs live.
      const roll = rng();
      const rank = roll < 0.1 ? 0n : roll < 0.2 ? count - 1n : randomBelow(rng, count);
      return { address: { params, rank } };
    }
    const known = Number.isNaN(count) ? declared?.known?.(params) : undefined;
    if (known !== undefined) {
      // An open problem with a table behind it: only the prefix it can produce.
      if (known <= 0n) return { discard: "empty" };
      return { address: { params, rank: randomBelow(rng, known) } };
    }
    // Infinite, or open but scanned (TwinPrimes): the size bounds the rank, or the family's
    // own `sized` for a scan.
    const bound =
      declared?.sized?.(params, size) ?? BigInt(declared === undefined ? Math.min(size, UNDECLARED_SIZE) : size);
    return { address: { params, rank: randomBelow(rng, bound + 1n) } };
  };

  const shrink = ({ params, rank }: Address): Address[] => {
    const out: Address[] = [];
    const mins = declared?.params.map((p) => p.min) ?? params.map(() => 0);
    params.forEach((value, i) => {
      for (let smaller = mins[i] as number; smaller < value; smaller++) {
        out.push({ params: params.map((v, j) => (j === i ? smaller : v)), rank });
      }
    });
    for (const smaller of new Set([0n, rank / 2n, rank - 1n]))
      if (smaller >= 0n && smaller < rank) out.push({ params, rank: smaller });
    return out;
  };

  const show = ({ params, rank }: Address): string =>
    `${family.head}${family.paramCount === 0 ? "" : `(${params.join(", ")})`}#${rank}`;

  return { family, declared, draw, shrink, show };
}
