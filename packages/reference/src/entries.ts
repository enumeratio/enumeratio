import type { OtherSystemRun, ReferenceEntry, ReferenceExample } from "./types.ts";
import { arithmetic } from "./entries/arithmetic.ts";
import arithmeticOracle from "./entries/arithmetic.oracle.json" with { type: "json" };
import { combinatorics } from "./entries/combinatorics.ts";
import combinatoricsOracle from "./entries/combinatorics.oracle.json" with { type: "json" };
import { collections } from "./entries/collections.ts";
import collectionsOracle from "./entries/collections.oracle.json" with { type: "json" };
import { enumerableFamilies } from "./entries/enumerable-families.ts";
import enumerableFamiliesOracle from "./entries/enumerable-families.oracle.json" with { type: "json" };
import { diagramAlgebras } from "./entries/diagram.ts";
import diagramOracle from "./entries/diagram.oracle.json" with { type: "json" };
import { elementary } from "./entries/elementary.ts";
import elementaryOracle from "./entries/elementary.oracle.json" with { type: "json" };
import { hecke } from "./entries/hecke.ts";
import heckeOracle from "./entries/hecke.oracle.json" with { type: "json" };
import { groupAlgebras } from "./entries/groupalgebra.ts";
import groupalgebraOracle from "./entries/groupalgebra.oracle.json" with { type: "json" };
import { braids } from "./entries/braid.ts";
import braidOracle from "./entries/braid.oracle.json" with { type: "json" };
import { modular } from "./entries/modular.ts";
import modularOracle from "./entries/modular.oracle.json" with { type: "json" };
import { hopf } from "./entries/hopf.ts";
import hopfOracle from "./entries/hopf.oracle.json" with { type: "json" };
import { incidence } from "./entries/incidence.ts";
import incidenceOracle from "./entries/incidence.oracle.json" with { type: "json" };
import { quiverAlgebras } from "./entries/quiver.ts";
import quiverOracle from "./entries/quiver.oracle.json" with { type: "json" };
import { numerals } from "./entries/numerals.ts";
import numeralsOracle from "./entries/numerals.oracle.json" with { type: "json" };
import { hypercomplex } from "./entries/hypercomplex.ts";
import hypercomplexOracle from "./entries/hypercomplex.oracle.json" with { type: "json" };
import { numberTheory } from "./entries/number-theory.ts";
import { adeles } from "./entries/adeles.ts";
import adelesOracle from "./entries/adeles.oracle.json" with { type: "json" };
import numberTheoryOracle from "./entries/number-theory.oracle.json" with { type: "json" };
import { sequences } from "./entries/sequences.ts";
import sequencesOracle from "./entries/sequences.oracle.json" with { type: "json" };
import { specialFunctions } from "./entries/special-functions.ts";
import specialFunctionsOracle from "./entries/special-functions.oracle.json" with { type: "json" };
import { analyticSpecial } from "./entries/analytic-special.ts";
import analyticSpecialOracle from "./entries/analytic-special.oracle.json" with { type: "json" };

/** An entry file's oracle sidecar (see `scripts/oracle-scan.ts`): kernel versions, and
 * every system's run of an example, by head then by `JSON.stringify(example.expr)`. A JSON
 * import's row type comes back widened to `string` fields, not `OtherSystemRun`'s literal
 * unions — the scan script is what actually constrains `verdict`/`kind`, so a cast at
 * `withOthers` closes the gap rather than fighting the importer's inferred type here. */
interface OracleSidecar {
  readonly kernels?: Readonly<Record<string, string>>;
  readonly examples?: Readonly<Record<string, Readonly<Record<string, Readonly<object>>>>>;
}

/** Attach a sidecar's `others` to each of an entry's examples, by expression key. Missing
 * sidecar rows leave `others` unset — absence just means unmapped or unscanned. */
const withOthers = (sidecar: OracleSidecar, entry: ReferenceEntry): ReferenceEntry => {
  const forHead = sidecar.examples?.[entry.name];
  if (forHead === undefined) return entry;
  const examples: readonly ReferenceExample[] = entry.examples.map((example) => {
    const others = forHead[JSON.stringify(example.expr)] as
      | Readonly<Record<string, OtherSystemRun>>
      | undefined;
    return others === undefined ? example : { ...example, others };
  });
  return { ...entry, examples };
};

const attach = (
  sidecar: OracleSidecar,
  entries: readonly ReferenceEntry[],
): readonly ReferenceEntry[] => entries.map((entry) => withOthers(sidecar, entry));

const SIDECARS: readonly OracleSidecar[] = [
  arithmeticOracle,
  combinatoricsOracle,
  collectionsOracle,
  enumerableFamiliesOracle,
  diagramOracle,
  elementaryOracle,
  heckeOracle,
  groupalgebraOracle,
  braidOracle,
  modularOracle,
  hopfOracle,
  incidenceOracle,
  quiverOracle,
  numeralsOracle,
  hypercomplexOracle,
  numberTheoryOracle,
  adelesOracle,
  sequencesOracle,
  specialFunctionsOracle,
  analyticSpecialOracle,
];

/** Every system's kernel version, as recorded by whichever sidecar last saw a scan of it. */
export const oracleKernels: Readonly<Record<string, string>> = Object.assign(
  {},
  ...SIDECARS.map((sidecar) => sidecar.kernels ?? {}),
);

/** The raw sidecars, by stem, before `others` is attached to examples — the golden test
 * reads these directly to catch a row whose key no longer names a current example. */
export const oracleSidecars: Readonly<Record<string, OracleSidecar>> = {
  arithmetic: arithmeticOracle,
  combinatorics: combinatoricsOracle,
  collections: collectionsOracle,
  "enumerable-families": enumerableFamiliesOracle,
  diagram: diagramOracle,
  elementary: elementaryOracle,
  hecke: heckeOracle,
  groupalgebra: groupalgebraOracle,
  braid: braidOracle,
  modular: modularOracle,
  hopf: hopfOracle,
  incidence: incidenceOracle,
  quiver: quiverOracle,
  numerals: numeralsOracle,
  hypercomplex: hypercomplexOracle,
  "number-theory": numberTheoryOracle,
  adeles: adelesOracle,
  sequences: sequencesOracle,
  "special-functions": specialFunctionsOracle,
  "analytic-special": analyticSpecialOracle,
};

/** One domain file, its entries (with `others` attached), and the stem the scan script
 * writes its sidecar under (`src/entries/<stem>.oracle.json`). */
export const entryFiles: readonly { stem: string; entries: readonly ReferenceEntry[] }[] = [
  { stem: "combinatorics", entries: attach(combinatoricsOracle, combinatorics) },
  { stem: "sequences", entries: attach(sequencesOracle, sequences) },
  { stem: "number-theory", entries: attach(numberTheoryOracle, numberTheory) },
  { stem: "adeles", entries: attach(adelesOracle, adeles) },
  { stem: "arithmetic", entries: attach(arithmeticOracle, arithmetic) },
  { stem: "elementary", entries: attach(elementaryOracle, elementary) },
  { stem: "special-functions", entries: attach(specialFunctionsOracle, specialFunctions) },
  { stem: "analytic-special", entries: attach(analyticSpecialOracle, analyticSpecial) },
  { stem: "hypercomplex", entries: attach(hypercomplexOracle, hypercomplex) },
  { stem: "diagram", entries: attach(diagramOracle, diagramAlgebras) },
  { stem: "numerals", entries: attach(numeralsOracle, numerals) },
  { stem: "hecke", entries: attach(heckeOracle, hecke) },
  { stem: "incidence", entries: attach(incidenceOracle, incidence) },
  { stem: "quiver", entries: attach(quiverOracle, quiverAlgebras) },
  { stem: "hopf", entries: attach(hopfOracle, hopf) },
  { stem: "groupalgebra", entries: attach(groupalgebraOracle, groupAlgebras) },
  { stem: "modular", entries: attach(modularOracle, modular) },
  { stem: "braid", entries: attach(braidOracle, braids) },
  { stem: "collections", entries: attach(collectionsOracle, collections) },
  { stem: "enumerable-families", entries: attach(enumerableFamiliesOracle, enumerableFamilies) },
];

// One flat list assembled from the per-domain files. Add a new domain by creating a
// sibling file under `entries/` (and a matching `<stem>.oracle.json` sidecar) and adding it
// to `entryFiles` above.
export const entries: readonly ReferenceEntry[] = entryFiles.flatMap((file) => file.entries);
