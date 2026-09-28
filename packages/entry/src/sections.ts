// The sections a head's examples fall into, in page order. An example without a `category`
// is Basic's; one naming a section not listed here follows the listed ones, in the order it
// first appears.

import type { ReferenceExample } from "./types.ts";

export const SECTIONS = ["Basic", "Scope", "Applications", "Properties", "Possible issues", "Neat examples"];

/** `examples` in page order: by section, each section's rows in the order given. */
export function bySection<T extends Pick<ReferenceExample, "category">>(examples: readonly T[]): T[] {
  const firstSeen = new Map<string, number>();
  examples.forEach(({ category = "Basic" }, i) => firstSeen.has(category) || firstSeen.set(category, i));
  const rank = (category = "Basic"): number => {
    const listed = SECTIONS.indexOf(category);
    return listed === -1 ? SECTIONS.length + firstSeen.get(category)! : listed;
  };
  return examples
    .map((example, i) => ({ example, i }))
    .sort((a, b) => rank(a.example.category) - rank(b.example.category) || a.i - b.i)
    .map(({ example }) => example);
}
