// Pure helpers turning an item's `#example/<id>` anchor into "what to look for" text
// pulled from the reference data -- the example's caption, or its expr when there's
// no caption. No reference-data access here (that's browser-only, via
// virtual:reference-entries) -- callers hand in the already-looked-up example. See
// ReviewPanel.vue for the wiring (getEntry + these).

export interface LookForExample {
  readonly caption?: string;
  readonly expr: unknown;
}

/** `/reference/symbol/<Name>` -> `<Name>`, else undefined for any other path shape. */
export function symbolNameFromPath(path: string): string | undefined {
  return /^\/reference\/symbol\/([^/]+)\/?$/.exec(path)?.[1];
}

/** An `example/<id>` anchor's id, else undefined for any other anchor shape. */
export function exampleIdFromAnchor(anchorId: string): string | undefined {
  return anchorId.startsWith("example/") ? anchorId.slice("example/".length) : undefined;
}

/** What to look for: the caption, or a compact rendering of expr when there's none. */
export function lookForText(example: LookForExample): string {
  return example.caption?.trim() || JSON.stringify(example.expr);
}
