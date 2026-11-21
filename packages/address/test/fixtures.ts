import type { Catalog, CollectionSpec, ParameterSpec } from '../src/names.ts';

const p = (word: string, size = false, aliases: string[] = []): ParameterSpec => ({
  word,
  aliases,
  size,
});

const c = (
  name: string,
  parameters: ParameterSpec[] = [],
  extra: Partial<CollectionSpec> = {},
): CollectionSpec => ({ name, aliases: [], parameters, ...extra });

/** A small catalog for the address tests (the real one is the route file, read in `packages/routes`). */
export const catalog: Catalog = {
  collections: [
    c('Natural', [], { aliases: ['NaturalNumber'] }),
    c('Prime', [], { aliases: ['PrimeNumber'] }),
    c('TwinPrime'),
    c('Permutation', [p('size', true)]),
    c('DyckPath', [p('semilength', true)]),
    c('SetPartition', [p('size', true), p('blocks')]),
    c('IntegerPartition', [p('size', true), p('parts')]),
    c('KSubset', [p('n', true), p('k')]),
    c('Simplex', [], { pluralException: 'Simplices' }),
  ],
  subjects: ['Area', 'DyckArea', 'Inverse', 'Inversions'],
};
