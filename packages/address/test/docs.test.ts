import { describe, expect, test } from 'vite-plus/test';
import { formatAddress, marks, parseAddress } from '../src/index.ts';
import { path } from './build.ts';
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
    expect(addresses).toContain(path('atlas'));
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
  });

  test.each(elements)('%s parses as an element', (span) => {
    const read = parseAddress(path('collection', 'X', span));
    expect(read.problems).toEqual([]);
    expect(read.canonical).toBe(true);
    expect(read.address.element).toBeDefined();
  });
});

describe('every query written in docs/site-map.md', () => {
  const queries = exampleQueries();

  test('the extraction found them', () => {
    expect(queries.length).toBeGreaterThan(2);
  });

  test.each(queries)('%s parses', (q) => {
    const read = parseAddress(path('collection', 'X'), q);
    expect(read.problems).toEqual([]);
    expect(read.address.query.length).toBeGreaterThan(0);
  });
});
