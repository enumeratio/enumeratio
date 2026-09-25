// Check every Wikidata id compute-engine puts on a symbol, and propose a replacement for
// the ones that are not about the symbol at all.
//
// The engine's `wikidata` field is the one part of its self-description nothing verifies,
// and a good deal of it is wrong: `PlanckConstant` points at Mount Vesuvius, `AiryAi` at an
// Egyptian prime minister. Those are not typos to shrug at -- they are the crosswalk's most
// authoritative-looking pointer, so they get checked like everything else, and the
// corrections live in `WIKIDATA_FIXES`.
//
// The check: fetch the item, and ask whether its English label has anything to do with the
// symbol's name or the engine's own description of it. A suspect is then searched for by
// name, and the candidates printed for a human to pick from -- nothing is written.
//
//   vp node packages/reference/scripts/audit-wikidata.ts

import { WIKIDATA_CONFIRMED, WIKIDATA_FIXES } from "../src/crosswalk/curated.ts";
import { engineSymbols } from "../src/engine-symbols-data.ts";

const API = "https://www.wikidata.org/w/api.php";
const headers = { "User-Agent": "notatio-crosswalk/0.1 (https://github.com/enumeratio)" };
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface Entity {
  readonly id: string;
  readonly labels?: { readonly en?: { readonly value: string } };
  readonly descriptions?: { readonly en?: { readonly value: string } };
}

async function fetchJson<T>(url: string, attempt = 0): Promise<T> {
  const response = await fetch(url, { headers });
  if (response.status === 429 && attempt < 4) {
    await sleep(2000 * 2 ** attempt);
    return fetchJson<T>(url, attempt + 1);
  }
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return (await response.json()) as T;
}

const chunks = <T>(list: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/** Words that say nothing about what a thing is. */
const STOP = new Set(["the", "and", "for", "with", "function", "number", "constant", "of", "a"]);
const words = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3 && !STOP.has(word));

/** Camel case split, so `PlanckConstant` reads as "planck constant". */
const spaced = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

/**
 * Whether an item plausibly IS the symbol: the label and the symbol's name share a word,
 * or the label's words turn up in the engine's description of the symbol. Deliberately
 * generous -- the point is to catch Mount Vesuvius, not to grade the good ones.
 */
function plausible(label: string, name: string, description: string): boolean {
  const flat = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (flat(label).includes(flat(name)) || flat(name).includes(flat(label))) return true;
  const haystack = `${spaced(name)} ${description}`.toLowerCase();
  const labelWords = words(label);
  if (labelWords.some((word) => haystack.includes(word))) return true;
  const nameWords = words(spaced(name));
  return nameWords.some((word) => label.toLowerCase().includes(word));
}

const claimed = engineSymbols.flatMap((symbol) => {
  const id = WIKIDATA_FIXES[symbol.name] ?? symbol.wikidata;
  return id ? [{ symbol, id, fixed: WIKIDATA_FIXES[symbol.name] !== undefined }] : [];
});

const items = new Map<string, Entity>();
for (const chunk of chunks([...new Set(claimed.map((c) => c.id))], 50)) {
  const body = await fetchJson<{ entities?: Record<string, Entity> }>(
    `${API}?action=wbgetentities&ids=${chunk.join("|")}&props=labels|descriptions&languages=en&format=json`,
  );
  for (const entity of Object.values(body.entities ?? {})) items.set(entity.id, entity);
}

const suspects: { name: string; id: string; label: string }[] = [];
let missing = 0;
for (const { symbol, id, fixed } of claimed) {
  const item = items.get(id);
  const label = item?.labels?.en?.value;
  if (!label) {
    process.stdout.write(`${symbol.name}: ${id} does not resolve\n`);
    missing += 1;
    continue;
  }
  if (plausible(label, symbol.name, symbol.description ?? "")) continue;
  // Named for the concept rather than the head, and checked by hand once.
  if (WIKIDATA_CONFIRMED.has(symbol.name)) continue;
  if (fixed) {
    process.stdout.write(`${symbol.name}: the FIX ${id} (${label}) looks wrong too\n`);
    continue;
  }
  suspects.push({ name: symbol.name, id, label });
}

process.stdout.write(`\n${claimed.length} ids checked — ${missing} dead, ${suspects.length} about something else\n\n`);

for (const suspect of suspects) {
  const query = encodeURIComponent(spaced(suspect.name).toLowerCase());
  const found = await fetchJson<{
    search: readonly { id: string; label?: string; description?: string }[];
  }>(`${API}?action=wbsearchentities&search=${query}&language=en&format=json&limit=3`);
  const candidates = found.search
    .map((hit) => `${hit.id} (${hit.label}${hit.description ? ` — ${hit.description}` : ""})`)
    .join("; ");
  process.stdout.write(
    `${suspect.name}: engine says ${suspect.id} = "${suspect.label}" → ${candidates || "nothing found"}\n`,
  );
  await sleep(400);
}
