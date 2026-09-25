// A reference entry for every symbol compute-engine binds that nothing of ours documents:
// the engine's description and signature, no examples, and whatever the crosswalk knows.
// Listed so that every head has a page -- and so a symbol's Wikidata id, its Fungrim
// identities and its Wolfram spelling are visible even where we changed nothing.

import { engineSymbols } from "./engine-symbols-data.ts";
import type { ReferenceEntry } from "./types.ts";

export const ENGINE_DOMAIN = "Compute engine";

/** Stub entries for the engine's own symbols, minus the names in `documented`. */
export function engineEntries(documented: ReadonlySet<string>): ReferenceEntry[] {
  return engineSymbols
    .filter((symbol) => !documented.has(symbol.name))
    .map((symbol) => ({
      name: symbol.name,
      domain: ENGINE_DOMAIN,
      signature: symbol.kind === "operator" ? `${symbol.name}${symbol.signature ?? ""}` : symbol.name,
      summary: symbol.description ?? "",
      examples: [],
      ...(symbol.signature
        ? {
            signatures: [
              {
                call:
                  symbol.kind === "operator"
                    ? `${symbol.name}${symbol.signature}`
                    : `${symbol.name}: ${symbol.signature}`,
                description:
                  symbol.kind === "operator"
                    ? "as compute-engine declares it"
                    : "a constant, as compute-engine declares it",
              },
            ],
          }
        : {}),
      stub: "engine",
    }));
}
