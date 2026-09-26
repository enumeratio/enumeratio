import { ComputeEngine } from "@cortex-js/compute-engine";
import { FUNGRIM_CORE } from "@cortex-js/compute-engine/identities";
import { CARRIERS, COLLECTIONS, MAPS, REFERENCES, STATS } from "@enumeratio/catalog/src";
import { DOMAINS } from "@enumeratio/domains/src";
import { MAPPINGS } from "@enumeratio/oracle/src";
import { HEADS, SYMBOLS } from "@enumeratio/wolfram/src";
import { expect, test } from "vite-plus/test";
import { crosswalk as derivedData } from "../src/crosswalk-data.ts";
import {
  CATALOG_ALIASES,
  CURATED,
  DLMF_NAMES,
  FUNGRIM_NAMES,
  WIKIDATA_CONFIRMED,
  WIKIDATA_FIXES,
} from "../src/crosswalk/curated-data.ts";
import { dlmfNotations, normaliseName } from "../src/crosswalk/dlmf.ts";
import { crosswalkFor, crosswalkForCollection, crosswalkForStatistic, hrefOf } from "../src/crosswalk/index.ts";
import { inventoryEntry } from "../src/crosswalk/inventory.ts";
import { SOURCES } from "../src/crosswalk/sources.ts";
import { engineEntries } from "../src/engine-entries.ts";
import { findstat } from "../src/findstat-data.ts";
import { fungrimVerified } from "../src/fungrim-verified-data.ts";
import { KNOWN_CAUSES } from "../src/crosswalk/fungrim.ts";
import { oeis } from "../src/oeis-data.ts";
import { engineSymbols as engineData } from "../src/engine-symbols-data.ts";
import { packageEntries, referenceEntries } from "../src/node.ts";

const entries = referenceEntries();
const collectionEntries = packageEntries("collections");
const statisticEntries = packageEntries("statistics");
const domainEntries = packageEntries("domains");
import { fungrimSymbols } from "../src/fungrim-symbols-data.ts";
import { crosswalk, engineSymbols } from "../scripts/crosswalk.ts";

test("the generated engine-symbol and crosswalk data are what the collector derives", () => {
  // Same guard as the provenance ledger: the committed files are a cache of a derivation,
  // and a dependency bump (a new engine, a new oracle row) has to show up as a diff here.
  const symbols = engineSymbols(new ComputeEngine());
  expect(symbols).toEqual(engineData);
  const names = [...new Set([...symbols.map((s) => s.name), ...entries.map((e) => e.name)])].sort();
  expect(crosswalk(names, FUNGRIM_CORE.rules, { ...SYMBOLS, ...HEADS }, MAPPINGS)).toEqual(derivedData);
});

/** Every name a curated row may be keyed by: a documented head, the engine's, a catalog name. */
const known = new Set<string>([
  ...entries.map((e) => e.name),
  ...collectionEntries.map((e) => e.name),
  ...statisticEntries.map((e) => e.name),
  ...domainEntries.map((e) => e.name),
  ...DOMAINS.map((d) => d.name),
  ...engineData.map((s) => s.name),
  ...COLLECTIONS.map((c) => c.name),
  ...CARRIERS.map((c) => c.name),
  ...STATS.map((s) => s.name),
  ...MAPS.map((m) => m.name),
]);

test("every curated head is a name something resolves", () => {
  // A row keyed by a misspelling would never be shown and never be noticed.
  expect(Object.keys(CURATED).filter((name) => !known.has(name))).toEqual([]);
});

test("every catalog alias names a catalog subject", () => {
  const subjects = new Set(REFERENCES.map((r) => r.subject));
  expect(Object.values(CATALOG_ALIASES).filter((s) => !subjects.has(s))).toEqual([]);
  const sage = crosswalkFor("SymmetricGroup").find((r) => r.system === "sage");
  expect(sage?.identity).toBe("Permutations(n)");
  expect(sage?.via).toBe("Permutations");
});

test("every Fungrim rename points at a published Fungrim symbol", () => {
  expect(
    Object.entries(FUNGRIM_NAMES)
      .filter(([, target]) => !fungrimSymbols.has(target))
      .map(([name, target]) => `${name} → ${target}`),
  ).toEqual([]);
});

test("every reference with a URL scheme resolves to a link", () => {
  for (const [name, references] of Object.entries(CURATED)) {
    for (const reference of references) {
      if (SOURCES[reference.system].href === undefined && reference.url === undefined) continue;
      expect(hrefOf(reference), `${name} ${reference.system}`).toMatch(/^https:\/\//);
    }
  }
});

test("a carrier inherits what the catalog knows about its collections", () => {
  // SetComposition is Sage's OrderedSetPartitions; the catalog recorded that against the
  // collection, and the carrier page is where a reader looks for it.
  const sage = crosswalkFor("SetComposition").find((r) => r.system === "sage");
  expect(sage?.identity).toContain("OrderedSetPartitions(n)");
  expect(sage?.via).toBe("SetCompositions");
  expect(sage?.href).toContain("set_partition_ordered");
  const wikipedia = crosswalkFor("SetPartition").filter((r) => r.system === "wikipedia");
  expect(wikipedia[0]?.origin).toBe("curated");
  expect(wikipedia[0]?.href).toBe("https://en.wikipedia.org/wiki/Partition_of_a_set");
});

test("a head's crosswalk draws on every origin", () => {
  const binomial = crosswalkFor("Binomial");
  const origins = new Set(binomial.map((r) => r.origin));
  expect([...origins].sort()).toEqual(["curated", "engine", "fungrim", "oracle", "wikidata", "wolfram"]);
  const wikidata = binomial.find((r) => r.system === "wikidata");
  expect(wikidata?.identity).toBe("Q209875");
  expect(wikidata?.href).toBe("https://www.wikidata.org/wiki/Q209875");
  // The catalog knew Binomial as Wolfram's too; the transpiler's row wins the same pointer.
  expect(binomial.filter((r) => r.system === "wolfram").map((r) => r.origin)).toEqual(["wolfram"]);
  const sage = crosswalkFor("SetPartitions").find((r) => r.system === "sage");
  expect(sage?.origin).toBe("catalog");
});

test("Zeta is Riemann's at one argument and Hurwitz's at two", () => {
  const zeta = crosswalkFor(
    "Zeta",
    entries.find((e) => e.name === "Zeta"),
  );
  const fungrim = zeta.filter((r) => r.system === "fungrim");
  expect(fungrim.map((r) => [r.identity, r.arity])).toEqual([
    ["RiemannZeta", undefined],
    ["HurwitzZeta", 2],
  ]);
  expect(zeta.some((r) => r.system === "fungrimEntry")).toBe(true);
});

test("a statistic links to its FindStat number on the carrier it is recorded for", () => {
  const findstat = crosswalkForStatistic("Descents", "Permutation").filter((r) => r.system === "findstat");
  expect(findstat.map((r) => r.identity)).toEqual(["St000021"]);
  expect(findstat[0]?.href).toBe("https://www.findstat.org/St000021");
  // On the head's own page the same row says which carrier it was recorded against.
  expect(crosswalkFor("Descents").find((r) => r.system === "findstat" && r.identity === "St000021")?.via).toBe(
    "Permutation",
  );
});

test("engine stubs cover exactly the symbols nothing documents", () => {
  const documented = new Set(entries.map((e) => e.name));
  const stubs = engineEntries(documented);
  expect(stubs.every((s) => s.stub === "engine" && !documented.has(s.name))).toBe(true);
  expect(stubs.length + [...documented].filter((n) => engineData.some((s) => s.name === n)).length).toBe(
    engineData.length,
  );
  const csch = stubs.find((s) => s.name === "Csch");
  expect(csch?.summary).toMatch(/cosecant/i);
});

test("Python references resolve to their documentation anchors", () => {
  // The oracle table says `zeta($1, $2)`; SymPy's inventory says where zeta is documented.
  expect(inventoryEntry("sympy", "zeta($1, $2)")?.url).toBe(
    "https://docs.sympy.org/latest/modules/functions/special.html#sympy.functions.special.zeta_functions.zeta",
  );
  // A module-qualified catalog identity matches exactly; a bare one finds the class.
  expect(inventoryEntry("sage", "OrderedSetPartitions(n)")?.name).toBe(
    "sage.combinat.set_partition_ordered.OrderedSetPartitions",
  );
  // Sage documents symbolic functions as the class behind them.
  expect(inventoryEntry("sage", "zeta($1)")?.name).toBe("sage.functions.transcendental.Function_zeta");
  // A class member of the same bare name is not the function.
  expect(inventoryEntry("sage", "psi($1, $2)")?.name ?? "none").not.toContain("QuasiSymmetricFunctions");
  // The catalog's module-page URL is upgraded to the anchored one on the same page.
  const sage = crosswalkFor("SetCompositions").find((r) => r.system === "sage");
  expect(sage?.href).toContain("#sage.combinat.set_partition_ordered.OrderedSetPartitions");
});

test("a Wikidata item answers for the encyclopaedias at once", () => {
  // Reached from the engine's Q-id; the curated Wikipedia and MathWorld rows already say
  // what the item says, so only the systems nobody wrote down arrive with its origin.
  const gamma = crosswalkFor("Gamma");
  expect(gamma.filter((r) => r.origin === "wikidata").map((r) => r.system)).toEqual([
    "encyclopediaofmath",
    "nlab",
    "britannica",
  ]);
  expect(gamma.find((r) => r.system === "nlab")?.href).toBe("https://ncatlab.org/nlab/show/Gamma+function");
  // Reached from a curated Wikipedia title: the item supplies the Q-id itself.
  const partition = crosswalkFor("SetPartition");
  expect(partition.find((r) => r.system === "wikidata")?.origin).toBe("wikidata");
  // The curated MathWorld row and Wikidata's agree on one pointer, shown once.
  expect(partition.filter((r) => r.system === "mathworld").map((r) => r.identity)).toEqual(["SetPartition"]);
});

test("the DLMF is reached by name, down to the defining equation", () => {
  expect(normaliseName("Stirling numbers of the first kind")).toBe(normaliseName("Stirling number of the first kind"));
  expect(normaliseName("Lambert W function")).toBe(normaliseName("Lambert W-function"));
  // Every DLMF wording we wrote down is one the handbook uses.
  expect(Object.entries(DLMF_NAMES).filter(([, n]) => !dlmfNotations(n).length)).toEqual([]);
  // The curated section (5) folds into the equation the index gives (5.2#E1).
  const gamma = crosswalkFor("Gamma").filter((r) => r.system === "dlmf");
  expect(gamma.map((r) => [r.identity, r.origin])).toEqual([["5.2#E1", "dlmf"]]);
  expect(gamma[0]?.href).toBe("https://dlmf.nist.gov/5.2#E1");
  // Arity follows the Wikipedia title that found the equation.
  const zeta = crosswalkFor("Zeta").filter((r) => r.system === "dlmf");
  expect(zeta.map((r) => [r.identity, r.arity])).toEqual([
    ["25.2#E1", 1],
    ["25.11#E1", 2],
  ]);
});

test("what the finder established by value agrees with what the catalog recorded", () => {
  // Two independent routes to a FindStat id -- the catalog's recorded rows and our value
  // sweep -- and where they contradict each other the values win, the case is pinned here
  // so a new one cannot slip in, and the fix goes in the catalog's reference-fixes.ts
  // (which is how Crank's St000146 became St000474).
  const KNOWN: string[] = [];
  const disagreements = findstat.flatMap((m) =>
    REFERENCES.filter(
      (r) =>
        r.kind === "stat" &&
        r.system === "findstat" &&
        r.subject === m.head &&
        r.on === m.on &&
        !m.findstat.includes(r.identity),
    ).map((r) => `${m.head}@${m.on}: catalog ${r.identity}, finder ${m.findstat.join("/")}`),
  );
  expect(disagreements).toEqual(KNOWN);
  // And the rows show up on the statistic, marked as found by value; a contradicted
  // catalog id does not.
  const descents = crosswalkForStatistic("Descents", "Permutation");
  expect(descents.filter((r) => r.system === "findstat").map((r) => r.identity)).toEqual(["St000021"]);
  const crank = crosswalkForStatistic("Crank", "IntegerPartition");
  expect(crank.filter((r) => r.system === "findstat").map((r) => r.identity)).toEqual(["St000474"]);
});

test("the engine's wrong Wikidata ids are replaced, not shown", () => {
  // 41 of the 101 ids compute-engine declares are dead or about something else entirely
  // (`scripts/audit-wikidata.ts`); every replacement wins over the engine's, and every head
  // named here is one the engine actually declares, so a rename upstream shows up as a
  // failure rather than a silently dead fix.
  const declared = new Set(engineData.filter((s) => s.wikidata).map((s) => s.name));
  expect(Object.keys(WIKIDATA_FIXES).filter((head) => !declared.has(head))).toEqual([]);
  expect([...WIKIDATA_CONFIRMED].filter((head) => !declared.has(head))).toEqual([]);
  for (const [head, id] of Object.entries(WIKIDATA_FIXES)) {
    const rows = crosswalkFor(head).filter((r) => r.system === "wikidata");
    expect(
      rows.map((r) => r.identity),
      head,
    ).toEqual([id]);
  }
  // And the item behind the fixed id is the one the encyclopaedias are keyed from.
  const planck = crosswalkFor("PlanckConstant");
  expect(planck.find((r) => r.system === "wikipedia")?.identity).toBe("Planck constant");
});

test("what the OEIS established by count agrees with what the catalog recorded", () => {
  // Same shape as the FindStat check, for the families whose counts ARE one sequence: where
  // those contradict a recorded A-number, the counts win and the case is pinned here. A
  // triangle is excluded because it has several true A-numbers (row sums, other offsets).
  const KNOWN: string[] = [];
  const disagreements = [...new Set(oeis.map((m) => m.head))].flatMap((head) => {
    const rows = oeis.filter((m) => m.head === head);
    if (rows.some((m) => m.triangle)) return [];
    const found = rows.map((m) => m.oeis);
    return REFERENCES.filter((r) => r.system === "oeis" && r.subject === head && !found.includes(r.identity)).map(
      (r) => `${head}: catalog ${r.identity}, counts ${found.join("/")}`,
    );
  });
  expect(disagreements).toEqual(KNOWN);
  // The recorded A-number leads and carries its verification; the rest coincide.
  const dyck = crosswalkForCollection("DyckPaths").filter((r) => r.system === "oeis");
  expect(dyck[0]?.identity).toBe("A000108");
  expect(dyck[0]?.verified).toEqual({ by: "terms", count: 16 });
  expect(dyck[0]?.origin).toBe("catalog");
  expect(dyck.slice(1).every((r) => r.relation === "aggregate")).toBe(true);
  // A family the catalog never counted is counted now.
  expect(crosswalkForCollection("IntegerPartitions").find((r) => r.system === "oeis")?.identity).toBe("A000041");
  // The empty-object convention is recorded on the row, not hidden.
  const trees = crosswalkForCollection("LabeledTrees").find((r) => r.identity === "A000272");
  expect(trees?.note).toContain("except the empty object: 0 here, 1 there");
});

test("a value-verified pointer keeps the row that recorded it and gains the mark", () => {
  const descents = crosswalkForStatistic("Descents", "Permutation").find((r) => r.system === "findstat");
  expect(descents?.origin).toBe("catalog");
  expect(descents?.verified).toEqual({ by: "values", count: 153 });
});

test("a two-parameter family is matched as its triangle, window and all", () => {
  const pascal = crosswalkForCollection("KSubsets").find((r) => r.system === "oeis");
  expect(pascal?.identity).toBe("A007318");
  expect(pascal?.verified).toEqual({ by: "terms", count: 28 });
  // Where the other convention starts is the useful part, so it is on the row.
  const weak = crosswalkForCollection("WeakCompositions").find((r) => r.system === "oeis");
  expect(weak?.note).toContain("theirs starts at row 0, column 1 of ours");
});

test("every Fungrim identity that disagrees has been looked into", () => {
  // The corpus is a test of our engine; a disagreement nobody has explained is a finding
  // waiting to be made, not a thing to leave lying in the data.
  const disagreeing = fungrimVerified.filter((row) => row.verdict === "disagree");
  expect(disagreeing.filter((row) => !KNOWN_CAUSES[row.entry]).map((row) => row.entry)).toEqual([]);
  expect(Object.keys(KNOWN_CAUSES).sort()).toEqual(disagreeing.map((row) => row.entry).sort());
});

test("a head's Fungrim chip carries how its identities came out", () => {
  const sin = crosswalkFor(
    "Sin",
    entries.find((e) => e.name === "Sin"),
  ).find((r) => r.system === "fungrim");
  expect(sin?.verified?.by).toBe("identities");
  expect(sin?.verified?.count).toBeGreaterThan(10);
  // EllipticE's disagreements are on the chip, and the entry says why.
  const elliptic = crosswalkFor("EllipticE");
  const chip = elliptic.find((r) => r.system === "fungrim");
  expect(chip?.verified?.disagree).toBe(2);
  const entry = elliptic.find((r) => r.identity === "16d2e1");
  expect(entry?.note).toContain("EllipticE is imprecise at complex modulus");
});

test("a head's examples run in another kernel score its chip there", () => {
  const binomial = crosswalkFor(
    "Binomial",
    entries.find((e) => e.name === "Binomial"),
  ).find((r) => r.system === "wolfram");
  expect(binomial?.verified?.by).toBe("examples");
  expect(binomial?.verified?.count).toBeGreaterThan(5);
  // A head whose examples parted company with the kernel says so rather than hiding it.
  const gcd = crosswalkFor(
    "GCD",
    entries.find((e) => e.name === "GCD"),
  ).find((r) => r.system === "wolfram");
  expect(gcd?.verified?.disagree).toBe(1);
});
