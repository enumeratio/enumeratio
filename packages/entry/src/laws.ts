// Expanding a map's law shorthand (`EntryLaw`, types.ts) into the formal statement it claims --
// a `ForAll`, as MathJSON. Pure data, no compute-engine dependency (this package has none): the
// point isn't to evaluate the statement, only to pin what the shorthand MEANS, so a drift test
// (tests/laws.test.ts) can catch the vocabulary silently changing meaning out from under every
// record that uses it.
//
// This is documentation, not the runtime mechanism: `@enumeratio/combinatorics`' own generator
// writes the SHORTHAND (unexpanded) into generated TS data, which populates
// `CombinatorialMap.laws`/`.orderIsomorphism` exactly as they were before this moved to
// records -- `checkLaws` (@enumeratio/structures) never sees a `ForAll`.

import type { MathJSON } from "./types.ts";
import type { EntryLaw } from "./types.ts";

/** One law's context: the map's own name, and the carrier types its overload (named by `on`,
 *  when the law is one of several for a shared name) reads and produces. */
export interface LawContext {
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

/** A law's formal claim: every map is typed (`typed`), and most laws add an equation over one
 *  element of `from` (`statement`) -- absent for `orderIsomorphism`, whose claim quantifies over
 *  a whole collection's ranking rather than one element (see its own `statement` shape below). */
export interface ExpandedLaw {
  readonly law: EntryLaw;
  /** `ForAll(Element(x, from), Element(f(x), to))` -- true of every map, restated formally. */
  readonly typed: MathJSON;
  readonly statement: MathJSON;
}

const typedStatement = (ctx: LawContext): MathJSON => [
  "ForAll",
  ["Element", "x", ctx.from],
  ["Element", [ctx.name, "x"], ctx.to],
];

/** `law`, expanded against the map context it applies to -- `ctx.name`/`from`/`to` are the
 *  overload the law is FOR (when a shared name has several, the caller picks the one `on`
 *  names; see `EntryLaw`'s own doc). */
export function expandLaw(law: EntryLaw, ctx: LawContext): ExpandedLaw {
  const { name, from } = ctx;
  const typed = typedStatement(ctx);
  if (law === "involution")
    return {
      law,
      typed,
      statement: ["ForAll", ["Element", "x", from], ["Equal", [name, [name, "x"]], "x"]],
    };
  if (law === "idempotent")
    return {
      law,
      typed,
      statement: ["ForAll", ["Element", "x", from], ["Equal", [name, [name, "x"]], [name, "x"]]],
    };
  if ("inverse" in law)
    return {
      law,
      typed,
      statement: ["ForAll", ["Element", "x", from], ["Equal", [law.inverse, [name, "x"]], "x"]],
    };
  // orderIsomorphism: the k-th element of `from` at size n maps to the k-th of `to` at size
  // n + sizeOffset -- quantified over both the size and the rank within it, not one element.
  const { from: source, to: target, sizeOffset = 0 } = law.orderIsomorphism;
  return {
    law,
    typed,
    statement: [
      "ForAll",
      [
        "And",
        ["Element", "n", "NonNegativeIntegers"],
        ["Element", "k", "PositiveIntegers"],
        ["LessEqual", "k", ["Count", ["At", source, "n"]]],
      ],
      ["Equal", [name, ["At", ["At", source, "n"], "k"]], ["At", ["At", target, ["Add", "n", sizeOffset]], "k"]],
    ],
  };
}

/** Every law an entry's `laws` declares that applies to overload `on` (or to every overload,
 *  when the law names none) -- see `EntryLaw`'s doc on why `on` exists. */
export function lawsFor(laws: readonly EntryLaw[] | undefined, on: string): readonly EntryLaw[] {
  return (laws ?? []).filter((law) => typeof law === "string" || law.on === undefined || law.on === on);
}
