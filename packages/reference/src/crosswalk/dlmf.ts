// The DLMF by name. The handbook's index of notations (`dlmf-data.ts`) names each function
// the way a reader would -- "gamma function", "Stirling number of the first kind" -- and
// so do the Wikipedia titles the crosswalk already carries, so a head reaches its defining
// equation through the names it has, plus a short table for the ones the DLMF words its own
// way (`DLMF_NAMES` in curated.ts).

import { type DlmfNotation, dlmf } from "../dlmf-data.ts";

/**
 * Names as the two sides would agree on them: lower case, straight quotes, hyphens as
 * spaces, plurals folded ("Bernoulli numbers" is "Bernoulli number"), no section anchor.
 */
export const normaliseName = (name: string): string =>
  name
    .replace(/#.*$/, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[-‐–—_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => (/^[a-z]{4,}s$/.test(word) && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word))
    .join(" ");

const byName = new Map<string, DlmfNotation[]>();
for (const row of dlmf) {
  const key = normaliseName(row.name);
  const group = byName.get(key) ?? [];
  if (!group.some((other) => other.ref === row.ref)) group.push(row);
  byName.set(key, group);
}

/** Every notation the DLMF lists under a name, or nothing. */
export const dlmfNotations = (name: string): readonly DlmfNotation[] => byName.get(normaliseName(name)) ?? [];
