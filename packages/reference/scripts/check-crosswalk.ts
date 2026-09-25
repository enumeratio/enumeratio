// Resolve every crosswalk link and report the ones that do not answer.
//
// The crosswalk is a table of pointers into other people's sites, and the only way to know
// a pointer is still good is to follow it. This is that lane: offline data, online check,
// never a gate -- run it when adding rows, or when a system is known to have moved.
//
//   vp node packages/reference/scripts/check-crosswalk.ts [--only wikipedia,mathworld] [--head Zeta]
//
// Reports each URL that is not a 2xx (a 3xx to the same page counts as fine) with the
// heads that point at it. Two systems are skipped unless asked for by `--only`: Fungrim
// entries (thousands of them, straight from the engine's compiled artifact, and the symbol
// page already proves the host is up), and OEIS and Britannica (behind bot challenges a
// script cannot pass; OEIS A-numbers are checked for shape, Britannica ids come from Wikidata).

import { COLLECTIONS, MAPS, STATS } from "@enumeratio/catalog/src";
import { CURATED } from "../src/crosswalk/curated.ts";
import { crosswalkFor } from "../src/crosswalk/index.ts";
import { isInventorySystem } from "../src/crosswalk/inventory.ts";
import type { CrosswalkSystem } from "../src/crosswalk/sources.ts";
import { engineSymbols } from "../src/engine-symbols-data.ts";
import { referenceEntries } from "../src/node.ts";

const entries = referenceEntries();

const args = process.argv.slice(2);
const option = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = option("--only")?.split(",") as CrosswalkSystem[] | undefined;
const head = option("--head");
const SKIPPED: readonly CrosswalkSystem[] = ["fungrimEntry", "oeis", "britannica"];

const names = head
  ? [head]
  : [
      ...new Set([
        ...entries.map((e) => e.name),
        ...engineSymbols.map((s) => s.name),
        ...Object.keys(CURATED),
        ...COLLECTIONS.map((c) => c.name),
        ...STATS.map((s) => s.name),
        ...MAPS.map((m) => m.name),
      ]),
    ].sort();

// One request per distinct URL, remembering who asked. A Python reference with no link is
// a name the system's documentation index does not carry -- worth a line, not a failure.
const targets = new Map<string, Set<string>>();
const unindexed: string[] = [];
for (const name of names) {
  const entry = entries.find((e) => e.name === name);
  for (const reference of crosswalkFor(name, entry)) {
    if (!reference.href) {
      if (isInventorySystem(reference.system)) {
        unindexed.push(`${name}: ${reference.system} ${reference.identity}`);
      }
      continue;
    }
    if (reference.system === "oeis" && !/^A\d{6}$/.test(reference.identity)) {
      process.stdout.write(`malformed OEIS id ${reference.identity} ← ${name}\n`);
    }
    if (only ? !only.includes(reference.system) : SKIPPED.includes(reference.system)) continue;
    const who = targets.get(reference.href) ?? new Set<string>();
    who.add(name);
    targets.set(reference.href, who);
  }
}

// A browser's user agent: OEIS sits behind a bot check that 403s a bare fetch.
const headers = {
  "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36",
};

const probe = async (url: string, attempt = 0): Promise<number> => {
  try {
    // HEAD first; a few hosts answer HEAD with 405 and GET with 200.
    let response = await fetch(url, { method: "HEAD", redirect: "follow", headers });
    if (response.status >= 400) {
      response = await fetch(url, { method: "GET", redirect: "follow", headers });
    }
    // Rate limiting and a gateway hiccup are the checker's fault, not the link's.
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 3000 * 2 ** attempt));
      return probe(url, attempt + 1);
    }
    return response.status;
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    return probe(url, attempt + 1);
  }
};

const urls = [...targets.keys()];
const bad: { url: string; status: number | string; who: string[] }[] = [];
const BATCH = 4;
for (let i = 0; i < urls.length; i += BATCH) {
  const slice = urls.slice(i, i + BATCH);
  const statuses = await Promise.all(slice.map((url) => probe(url).catch((error: Error) => error.message)));
  slice.forEach((url, j) => {
    const status = statuses[j]!;
    if (typeof status === "number" && status >= 200 && status < 300) return;
    bad.push({ url, status, who: [...targets.get(url)!].sort() });
  });
  process.stderr.write(`\r${Math.min(i + BATCH, urls.length)}/${urls.length}`);
}
process.stderr.write("\n");

if (unindexed.length && !only) {
  process.stdout.write(`not in any documentation index:\n  ${unindexed.join("\n  ")}\n`);
}
for (const { url, status, who } of bad) {
  process.stdout.write(`${status}  ${url}  ← ${who.join(", ")}\n`);
}
process.stdout.write(`${urls.length} links checked, ${bad.length} not resolving\n`);
process.exitCode = bad.length ? 1 : 0;
