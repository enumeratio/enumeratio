import { type Address, areas, marks, queryWords } from '@enumeratio/address';
import { rowByName } from '@enumeratio/routes';

/** The word a collection gives its size parameter, from its route row. */
function sizeWord(name: string): string {
  const word = rowByName.get(name)?.parameters?.find((p) => p.size)?.word;
  if (word === undefined) throw new Error(`${name} has no size parameter in the route file`);
  return word;
}

/** The word of Subset's second parameter (the subset size k), from its route row. */
const kWord = (() => {
  const word = rowByName.get('Subset')?.parameters?.[1]?.word;
  if (word === undefined) throw new Error('Subset has no second parameter in the route file');
  return word;
})();

const ordered = (...items: (string | number)[]) => items.join(marks.ordered);
const unordered = (...items: (string | number)[]) => items.join(marks.unordered);
const blocks = (...items: (string | number)[]) => items.join(marks.block);

const inCollection = (
  name: string,
  parameters: { word: string; value: string }[],
  element?: string,
  properties: string[] = [],
  query: [string, string][] = [],
): Address => ({
  area: areas.collection,
  collection: { name, parameters },
  ...(element === undefined ? {} : { element: { kind: 'value', value: element } as const }),
  chain: properties.map((name) => ({ kind: 'property', name, parameters: [] }) as const),
  query,
});

/** One address to try for each row of the site map's §9 table. */
export const tryThese: { what: string; address: Address }[] = [
  {
    what: 'a number, led by its factorization',
    address: inCollection('Natural', [], '360', ['Factorization']),
  },
  {
    what: 'a permutation, read through a map into another collection',
    address: inCollection('Permutation', [], ordered(3, 1, 4, 2), ['Inverse', 'CycleType']),
  },
  {
    what: 'a Dyck path and its area',
    address: inCollection('DyckPath', [], '11010010', ['Area']),
  },
  {
    what: 'the second block of a set partition',
    address: {
      ...inCollection('SetPartition', [], blocks(unordered(1, 3), 2, 4)),
      chain: [
        { kind: 'property', name: 'Blocks', parameters: [] },
        { kind: 'index', index: 2 },
      ],
    },
  },
  {
    what: 'an integer partition (its short form is refused)',
    address: inCollection('IntegerPartition', [], ordered(4, 2, 1)),
  },
  {
    what: 'a row of Pascal’s triangle',
    address: inCollection(
      'Subset',
      [{ word: sizeWord('Subset'), value: '5' }],
      undefined,
      [],
      [[queryWords.groupBy, kWord]],
    ),
  },
];
