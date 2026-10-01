// Every package's notation entry, by manifest name, as the manifest's `NOTATIONS` lists them
// (tests/notation.test.ts holds the two together). Imported statically: the entries are light,
// and a session's engine needs all of them when it's constructed.

import { notation as analytic } from "@enumeratio/analytic/notation";
import type { PackageNotation } from "@enumeratio/boxes";
import { notation as braid } from "@enumeratio/braid/notation";
import { notation as combinatorics } from "@enumeratio/combinatorics/notation";
import { notation as diagram } from "@enumeratio/diagram/notation";
import { notation as groupalgebra } from "@enumeratio/groupalgebra/notation";
import { notation as hecke } from "@enumeratio/hecke/notation";
import { notation as hopf } from "@enumeratio/hopf/notation";
import { notation as hypercomplex } from "@enumeratio/hypercomplex/notation";
import { notation as incidence } from "@enumeratio/incidence/notation";
import { notation as modular } from "@enumeratio/modular/notation";
import { notation as numberTheory } from "@enumeratio/number-theory/notation";
import { notation as numerals } from "@enumeratio/numerals/notation";
import { notation as quiver } from "@enumeratio/quiver/notation";
import { notation as residues } from "@enumeratio/residues/notation";
import { notation as structures } from "@enumeratio/structures/notation";

export const NOTATION_ENTRIES: Readonly<Record<string, PackageNotation>> = {
  analytic,
  braid,
  combinatorics,
  diagram,
  groupalgebra,
  hecke,
  hopf,
  hypercomplex,
  incidence,
  modular,
  "number-theory": numberTheory,
  numerals,
  quiver,
  residues,
  structures,
};
