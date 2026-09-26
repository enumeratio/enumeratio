// A map's laws, checked at one element (design/plausible.md §4.2). The carrier is the category:
// a law declared on a map holds for every value of its `from` domain, so Plausible checks it
// on elements drawn from every family over that carrier. Every map is also checked TYPED —
// its result is a value of the `to` domain — whether or not it declares anything.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import type { CombinatorialMap, Law } from "./map.ts";

export interface LawFailure {
  readonly map: string;
  readonly law: string;
  readonly subject: unknown;
  readonly detail: string;
}

const lawName = (law: Law): string => (typeof law === "string" ? law : `inverse ${law.inverse}`);

/** The map's laws at `subject` (a constructed value, e.g. `["Permutation", ["List", 2, 1]]`).
 *  `undefined` when they hold, or when the map declines the subject (a guarded map such as
 *  KrewerasComplement stays unevaluated outside its domain — a decline, not a failure). */
export function checkLaws(ce: ComputeEngine, map: CombinatorialMap, subject: unknown): LawFailure | undefined {
  const fail = (law: string, detail: string): LawFailure => ({ map: map.name, law, subject, detail });
  const apply = (head: string, x: unknown): BoxedExpression => ce.box([head, x] as never).evaluate();
  const same = (a: BoxedExpression, b: unknown): boolean =>
    JSON.stringify(a.json) === JSON.stringify(ce.box(b as never).evaluate().json);

  let image: BoxedExpression;
  try {
    image = apply(map.name, subject);
  } catch (error) {
    return fail("typed", `threw: ${String(error).slice(0, 120)}`);
  }
  if (image.operator === map.name) return undefined; // declined
  if (image.operator === "Error" || String(image.type) !== map.to) {
    return fail(
      "typed",
      `${map.name} gave ${JSON.stringify(image.json).slice(0, 80)} of type ${String(image.type)}, not ${map.to}`,
    );
  }

  for (const law of map.laws ?? []) {
    const name = lawName(law);
    const back =
      law === "involution"
        ? same(apply(map.name, image.json), subject)
        : law === "idempotent"
          ? same(apply(map.name, image.json), image.json)
          : same(apply(law.inverse, image.json), subject);
    if (!back) return fail(name, `fails at ${JSON.stringify(ce.box(subject as never).json).slice(0, 80)}`);
  }
  return undefined;
}
