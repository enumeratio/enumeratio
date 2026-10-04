// Every package's notation together (BL-33). compute-engine warns on a duplicate name, not on a
// duplicate trigger, and MathLive flags only LaTeX it can't read, so a package whose trigger
// shadows another's, or whose StandardForm doesn't read back, is caught here or nowhere.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ComputeEngine, LATEX_DICTIONARY, LatexSyntax } from "@cortex-js/compute-engine";
import type { LatexDictionaryEntry } from "@cortex-js/compute-engine/latex-syntax";
import { compileNotation } from "@enumeratio/boxes";
import { displayDictionary } from "@enumeratio/frontend/display";
import type { NotationData } from "@enumeratio/manifest";
import { recordsRoot, referenceData } from "@enumeratio/reference/node";
import { expect, test } from "vite-plus/test";
import { DECLARATIONS, NOTATION, NOTATION_ENTRIES } from "../src/engine.ts";

type Entry = Partial<LatexDictionaryEntry>;

/** An entry's triggers, each keyed by its kind: two entries with one key compete for the same
 *  input. */
function triggers(entry: Entry): string[] {
  const e = entry as { kind?: string; latexTrigger?: string | readonly string[]; symbolTrigger?: string };
  const kind = e.kind ?? "expression";
  const spell = (t: string | readonly string[]): string => (typeof t === "string" ? t : t.join(""));
  return [
    ...(e.latexTrigger === undefined ? [] : [`${kind} ${spell(e.latexTrigger)}`]),
    ...(e.symbolTrigger === undefined ? [] : [`${kind} symbol:${e.symbolTrigger}`]),
  ];
}

/** Who claims each trigger: `owners` maps each source to its entries. */
function claims(owners: Readonly<Record<string, readonly Entry[]>>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [owner, entries] of Object.entries(owners))
    for (const entry of entries)
      for (const key of triggers(entry)) out.set(key, [...(out.get(key) ?? []), `${owner}:${entry.name ?? "?"}`]);
  return out;
}

const PACKAGES = Object.fromEntries(Object.entries(NOTATION_ENTRIES).map(([name, n]) => [name, n.latex ?? []]));

/**
 * A published library's notation, as a host loads it beside ours: every `reference/<Name>/notation.json`
 * of the fixture libraries (a copy of the manifest's, so the census stands alone), compiled for
 * the head its definition is declared as. A library whose trigger shadows ours is caught by the
 * same checks.
 */
const LIBRARIES_DIR = new URL("./fixtures/libraries/", import.meta.url).pathname;
const LIBRARIES: Record<string, readonly Entry[]> = {};
for (const library of readdirSync(LIBRARIES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const symbols = join(LIBRARIES_DIR, library.name, "reference");
  for (const name of readdirSync(symbols, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)) {
    const file = join(symbols, name, "notation.json");
    if (!existsSync(file)) continue;
    const data = JSON.parse(readFileSync(file, "utf8")) as NotationData;
    LIBRARIES[`${library.name}/${name}`] = compileNotation(`${library.name}_${name}`, data).latex;
  }
}

const LATEX = { ...PACKAGES, ...LIBRARIES };

test("the fixture libraries' notation is among what's checked", () => {
  expect(Object.keys(LIBRARIES)).toContain("bob-extra/Scaled");
});

test("no trigger is claimed by two packages' entries of the same kind", () => {
  const shared = [...claims(LATEX)].filter(([, who]) => who.length > 1);
  expect(Object.fromEntries(shared)).toEqual({});
});

test("no head is written by two packages' entries", () => {
  // The host merges by name and keeps the last, so a second package's entry silently wins.
  const writers = new Map<string, string[]>();
  for (const [pkg, entries] of Object.entries(LATEX))
    for (const name of new Set(entries.map((e) => e.name).filter((n) => n !== undefined)))
      writers.set(name, [...(writers.get(name) ?? []), pkg]);
  expect(Object.fromEntries([...writers].filter(([, pkgs]) => pkgs.length > 1))).toEqual({});
});

/** Triggers a package takes over from the host's own dictionary, deliberately. */
const OVERRIDES: Record<string, string> = {
  "infix \\pmod": "residues: `a \\pmod{n}` is the class IntegerMod(a, n), not compute-engine's Mod",
};

test("a package claims a trigger the host's dictionary has only where it means to replace it", () => {
  const ours = claims(LATEX);
  // compute-engine's, with the front end's own entries (the conventional spellings, boxes').
  const theirs = claims({ host: displayDictionary(LATEX_DICTIONARY) });
  const taken = [...ours.keys()].filter((key) => theirs.has(key)).toSorted();
  expect(taken).toEqual(Object.keys(OVERRIDES).toSorted());
});

// One engine per dictionary, with everything declared: how a head parses can depend on what's
// declared (`f(x)` is a call only when `f` is a function).
const engine = (extra: readonly Entry[]): ComputeEngine => {
  const ce = new ComputeEngine({
    latexSyntax: new LatexSyntax({ dictionary: displayDictionary(LATEX_DICTIONARY, extra) as never[] }),
  });
  for (const declare of DECLARATIONS) declare(ce);
  return ce;
};

/** `f` in a scope of its own: boxing or parsing `g(1, 2)` declares `g` a function, and one
 *  example's symbols would change how the next one parses. */
function scoped<T>(ce: ComputeEngine, f: () => T): T {
  ce.pushScope();
  try {
    return f();
  } finally {
    ce.popScope();
  }
}

const { heads } = referenceData(recordsRoot(import.meta.dirname));
const text = (value: unknown): string => JSON.stringify(value);

test("StandardForm round trip: each head with a LaTeX entry writes what reads back", () => {
  const ce = engine(NOTATION.latex);
  const named = new Set(NOTATION.latex.map((e) => e.name).filter((n) => n !== undefined));
  const failures: string[] = [];
  for (const h of heads.filter((h) => named.has(h.head)))
    for (const example of h.entry.examples)
      scoped(ce, () => {
        const before = ce.box(example.expr as never);
        const after = ce.parse(before.latex);
        if (text(after.json) !== text(before.json))
          failures.push(`${h.head} example/${example.id}: ${before.latex} reads as ${text(after.json)}`);
      });
  expect(failures).toEqual([]);
});

test("interference: each package's examples read the same with only its notation and with everyone's", () => {
  const all = engine(NOTATION.latex);
  const engines = new Map<string, ComputeEngine>();
  const own = (pkg: string): ComputeEngine => {
    let ce = engines.get(pkg);
    if (ce === undefined) engines.set(pkg, (ce = engine(NOTATION_ENTRIES[pkg]?.latex ?? [])));
    return ce;
  };
  const failures: string[] = [];
  for (const h of heads) {
    const ce = own(h.package);
    for (const example of h.entry.examples) {
      let tex: string;
      try {
        tex = scoped(ce, () => ce.box(example.expr as never).latex);
      } catch {
        // Not a notation question: an example compute-engine can't box (a malformed
        // argument a head's page shows on purpose) has no StandardForm to read.
        continue;
      }
      const alone = text(scoped(ce, () => ce.parse(tex).json));
      const together = text(scoped(all, () => all.parse(tex).json));
      if (alone !== together)
        failures.push(`${h.package} ${h.head} example/${example.id}: ${tex}: ${alone} vs ${together}`);
    }
  }
  expect(failures).toEqual([]);
}, 600_000);
