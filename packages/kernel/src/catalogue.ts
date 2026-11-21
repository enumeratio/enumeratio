/**
 * notatio's libraries, as the kernel declares them: each one on demand, when an
 * expression first names a head of it. The page's worker and the tests in Node
 * read this one list, so both evaluate with the same definitions.
 *
 * The shape follows the notatio site's own worker catalogue; only the libraries
 * the first pass needs are here.
 */
import type { ComputeEngine } from '@cortex-js/compute-engine';
import boxesDeclares from '@notatio/boxes/declares.json' with { type: 'json' };
import combinatoricsDeclares from '@notatio/combinatorics/declares.json' with { type: 'json' };
import formatsDeclares from '@notatio/formats/declares.json' with { type: 'json' };
import frontendDeclares from '@notatio/frontend/declares.json' with { type: 'json' };
import type { Library, LibraryDeclares } from '@notatio/manifest';
import numberTheoryDeclares from '@notatio/number-theory/declares.json' with { type: 'json' };
import numeralsDeclares from '@notatio/numerals/declares.json' with { type: 'json' };
import residuesDeclares from '@notatio/residues/declares.json' with { type: 'json' };
import structuresDeclares from '@notatio/structures/declares.json' with { type: 'json' };

const combinatorics = async (ce: ComputeEngine): Promise<void> => {
  const { CARRIERS, declareCombinatorics, declareMaps } = await import('@notatio/combinatorics');
  const { declareCarrierElement, declareCarrierPlurals } = await import('@notatio/structures');
  declareCombinatorics(ce);
  declareCarrierPlurals(ce, CARRIERS);
  declareCarrierElement(ce, CARRIERS);
  declareMaps(ce, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));
};

export const catalogue: readonly Library<ComputeEngine>[] = [
  {
    name: 'structures',
    declares: structuresDeclares as LibraryDeclares,
    declare: async (ce) => (await import('@notatio/structures')).declareStructures(ce),
  },
  {
    name: 'combinatorics',
    declares: combinatoricsDeclares as LibraryDeclares,
    names: ['CombinatorialStat', 'Tally'],
    declare: combinatorics,
  },
  {
    name: 'frontend',
    declares: frontendDeclares as LibraryDeclares,
    global: true,
    declare: async (ce) =>
      (await import('@notatio/frontend/declare-carriers')).declareFrontendCarriers(ce),
  },
  {
    name: 'formats',
    declares: formatsDeclares as LibraryDeclares,
    global: true,
    declare: async (ce) => (await import('@notatio/formats')).declareGraphics(ce),
  },
  {
    name: 'boxes',
    declares: boxesDeclares as LibraryDeclares,
    declare: async (ce) => (await import('@notatio/boxes')).declareBoxes(ce),
  },
  {
    name: 'residues',
    declares: residuesDeclares as LibraryDeclares,
    declare: async (ce) => (await import('@notatio/residues')).declareResidues(ce),
  },
  {
    name: 'numerals',
    declares: numeralsDeclares as LibraryDeclares,
    declare: async (ce) => (await import('@notatio/numerals')).declareNumerals(ce),
  },
  {
    name: 'number-theory',
    declares: numberTheoryDeclares as LibraryDeclares,
    declare: async (ce) => (await import('@notatio/number-theory')).declareNumberTheory(ce),
  },
];
