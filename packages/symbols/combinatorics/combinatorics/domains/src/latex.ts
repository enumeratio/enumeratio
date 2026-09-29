// LaTeX dictionary entries for the carrier constructors.
//
// Two different jobs, and conflating them is the mistake this file exists to avoid.
//
//   DISPLAY     what a person should read — `2\,3\,1`, `(1\,2\,3)`. That is the `latex`
//               medium in representation.ts, reached through `Render`.
//   ROUND TRIP  what the engine writes when the text has to be readable BACK. That is these
//               dictionary entries, and they keep a trigger.
//
// The measurement that forces the split:
//
//   2\,3\,1          parses as the number 231
//   (1\,2\,3)        parses as 123 — LaTeX parentheses are grouping, not cycle structure
//   \perm(2, 3, 1)   parses as the permutation
//
// Conventional notation is generally NOT recoverable on its own. It leans on a reader who
// already knows what kind of thing is written, and a parser has no such reader. So the
// engine's own serialisation is triggered, and the conventional spelling stays available for
// display — which is the honest division rather than a compromise.
//
// These entries cannot be contributed by `declareDomains`: compute-engine takes its LaTeX
// dictionary as a CONSTRUCTOR option that REPLACES the default (design/upstreaming.md §3.7).
// A caller merges them:
//
//   new ComputeEngine({ latexSyntax: new LatexSyntax({
//     dictionary: [...LATEX_DICTIONARY, ...carrierLatex(DOMAINS)],
//   })})

import type { Domain } from "./types.ts";

/** Loose shape of a compute-engine LaTeX dictionary entry, typed structurally so this
 *  data-only module does not drag the engine's types in. */
export interface LatexEntry {
  readonly kind: "function";
  readonly name: string;
  readonly latexTrigger: string;
  readonly serialize: (serializer: unknown, expr: unknown) => string;
  readonly parse: (parser: { parseArguments: () => unknown[] | null }) => unknown;
}

/** The trigger for a carrier constructor — `\perm`, `\intpart`, … Short, and distinct from
 *  anything in the standard dictionary. */
export const triggerFor = (domain: Domain): string =>
  `\\${domain.type.replace(/_(.)/g, (_, c: string) => c.toUpperCase())}`;

/** The operands of a constructed carrier value, as raw MathJSON. */
function contentsOf(expr: unknown): unknown[] {
  const call = Array.isArray(expr) ? expr : [];
  const inner = call[1];
  return Array.isArray(inner) && inner[0] === "List" ? inner.slice(1) : [];
}

/**
 * A dictionary entry per carrier: serialises with its trigger so the result reads back, and
 * parses that trigger into the constructor.
 */
export function carrierLatex(domains: readonly Domain[]): LatexEntry[] {
  return domains.map((domain) => ({
    kind: "function" as const,
    name: domain.name,
    latexTrigger: triggerFor(domain),
    serialize: (_serializer: unknown, expr: unknown): string =>
      `${triggerFor(domain)}(${contentsOf(expr).map(String).join(", ")})`,
    parse: (parser: { parseArguments: () => unknown[] | null }): unknown => [
      domain.name,
      ["List", ...(parser.parseArguments() ?? [])],
    ],
  }));
}
