import { describe, expect, test } from 'vite-plus/test';
import { formatAddress, marks, parseAddress, queryWords } from '../src/index.ts';
import { blocks, notation, ordered, path, query, rank, seg, unordered } from './build.ts';
import {
  exampleAddresses,
  exampleCollectionPaths,
  exampleElements,
  exampleQueries,
} from './docs.ts';

// The examples are extracted from docs/site-map.md, so the document and the
// parser cannot drift: change a mark or an example and these follow.

function split(address: string): [string, string] {
  const at = address.indexOf(marks.query);
  return at < 0 ? [address, ''] : [address.slice(0, at), address.slice(at)];
}

describe('every address written in docs/site-map.md', () => {
  const addresses = exampleAddresses();

  test('the extraction found them', () => {
    expect(addresses.length).toBeGreaterThan(20);
    // One of each kind, built from the table, must be among those extracted.
    const named = [
      path('atlas'),
      path('collection', 'DyckPath', '11010010', 'Area'),
      path('collection', seg('KSubset', ['n', 5])) + query([queryWords.groupBy, 'k']),
      path('stat', 'Area', seg('DyckPath', ['semilength', 4])),
      path('collection', 'SetPartition', blocks(unordered(1, 3), 2, 4), 'Blocks', '2'),
      path('collection', 'Natural', '3811', seg('Numeral', ['base', 60])),
    ];
    for (const expected of named) expect(addresses).toContain(expected);
  });

  test.each(addresses)('%s parses', (address) => {
    const [p, q] = split(address);
    const read = parseAddress(p, q);
    expect(read.problems).toEqual([]);
    // Writing what was read and reading it again changes nothing.
    const again = parseAddress(...split(formatAddress(read.address)));
    expect(again.address).toEqual(read.address);
    expect(again.canonical).toBe(true);
  });
});

describe('every relative collection address written in docs/site-map.md', () => {
  const paths = exampleCollectionPaths();

  test('the extraction found them', () => {
    expect(paths.length).toBeGreaterThan(10);
    expect(paths).toContain(seg('SetPartition', ['size', 4], ['blocks', 2]));
    expect(paths).toContain(path('Natural', '360', 'Factorization').slice(marks.segment.length));
  });

  test.each(paths)('%s parses', (span) => {
    const read = parseAddress(path('collection', span));
    expect(read.problems).toEqual([]);
    expect(read.address.collection?.name).toMatch(/^[A-Z]/);
  });
});

describe('every element written in docs/site-map.md (§2.2, §2.5)', () => {
  const elements = exampleElements();

  test('the extraction found them', () => {
    expect(elements.length).toBeGreaterThan(8);
    expect(elements).toContain(rank(7, 'lex'));
    expect(elements).toContain(notation('cycle', `(${ordered(1, 2)})(${ordered(3, 4)})`));
    expect(elements).toContain(ordered(2, 1, 4, 3));
  });

  test.each(elements)('%s parses as an element', (span) => {
    const read = parseAddress(path('collection', 'X', span));
    expect(read.problems).toEqual([]);
    expect(read.address.element).toBeDefined();
    // A notation-prefixed value is read, never canonical (draft 3.2); nothing else is refused.
    const prefixed = read.address.element?.kind === 'value' && !!read.address.element.notation;
    expect(read.canonical).toBe(!prefixed);
    expect(read.canonicalPath).toBe(path('collection', 'X', span));
  });
});

describe('every query written in docs/site-map.md', () => {
  const queries = exampleQueries();

  test('the extraction found them', () => {
    expect(queries.length).toBeGreaterThan(2);
    expect(queries).toContain(query([queryWords.as, 'cycle']));
  });

  test.each(queries)('%s parses', (q) => {
    const read = parseAddress(path('collection', 'X'), q);
    expect(read.problems).toEqual([]);
    expect(read.address.query.length).toBeGreaterThan(0);
  });
});
