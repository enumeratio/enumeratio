import { describe, expect, test } from 'vite-plus/test';
import {
  findCollection,
  lookupOf,
  marks,
  nameKey,
  parseAddress,
  formatAddress,
  pluralOf,
} from '@enumeratio/address';
import { codeSpans, exampleCollectionPaths, siteMapText } from '../../address/test/docs.ts';
import {
  catalog,
  columns,
  kinds,
  noParameters,
  parseRouteFile,
  promiseStarted,
  routeFile,
  rowByName,
  rows,
  statuses,
  unrestrictedCollection,
} from '../src/index.ts';

const firstPass = [
  'Natural',
  'Prime',
  'Permutation',
  'DyckPath',
  'SetPartition',
  'IntegerPartition',
  'KSubset',
];

describe('the route file', () => {
  test('a header field says the promise has not started', () => {
    expect(routeFile.meta.promise).toBeDefined();
    expect(['not started', 'started']).toContain(routeFile.meta.promise);
    // Until the site is announced; this test is edited on that day, on purpose.
    expect(promiseStarted).toBe(false);
  });

  test('statuses and kinds are from the closed lists', () => {
    expect(statuses).toEqual(['proposed', 'reserved', 'stub', 'live']);
    for (const row of rows) {
      expect(statuses, row.name).toContain(row.status);
      expect(kinds, row.name).toContain(row.kind);
    }
  });

  test('a row that cannot be read is an error, not a guess', () => {
    const head = columns.join('\t');
    expect(() => parseRouteFile(`${head}\nX\tcollection`)).toThrow(/columns/);
    const cells = (status: string) =>
      ['X', 'collection', status, '', '', '', '', '', '', '', 'a', '2026-01-01'].join('\t');
    expect(() => parseRouteFile(`${head}\n${cells('draft')}`)).toThrow(/status/);
    expect(() => parseRouteFile(`nonsense\n${cells('live')}`)).toThrow(/header/);
    expect(parseRouteFile(`${head}\n${cells('live')}`).rows).toHaveLength(1);
  });

  test('every name is PascalCase and no name is listed twice', () => {
    const seen = new Set<string>();
    for (const row of rows) {
      expect(row.name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
      expect(seen.has(row.name), `${row.name} is listed twice`).toBe(false);
      seen.add(row.name);
    }
  });

  test('no two names share a key; every alias and plural resolves to exactly one row', () => {
    const { conflicts } = lookupOf(catalog);
    expect([...conflicts.keys()]).toEqual([]);
    const keys = new Set(rows.map((r) => nameKey(r.name)));
    expect(keys.size).toBe(rows.length);
    for (const row of rows) {
      for (const alias of [...row.aliases, pluralOf(row.name, row.pluralException)]) {
        expect(findCollection(catalog, alias)?.name, alias).toBe(row.name);
      }
    }
  });

  test('every stub or live row has an expression and declared parameters', () => {
    for (const row of rows.filter((r) => r.status === 'stub' || r.status === 'live')) {
      expect(row.expression, `${row.name} needs an expression`).toBeTruthy();
      expect(
        row.parameters,
        `${row.name} needs declared parameters (${noParameters} for none)`,
      ).toBeDefined();
      for (const p of row.parameters ?? []) {
        expect(row.expression, `${row.name}: the expression uses ${p.word}`).toMatch(
          new RegExp(`\\b${p.word}\\b`),
        );
      }
    }
  });

  test('parameters: lowercase words, distinct, at most one size parameter', () => {
    for (const row of rows) {
      const words = (row.parameters ?? []).map((p) => p.word);
      for (const w of words) expect(w, row.name).toMatch(/^[a-z][a-z0-9]*$/);
      expect(new Set(words.map(nameKey)).size, row.name).toBe(words.length);
      expect((row.parameters ?? []).filter((p) => p.size).length, row.name).toBeLessThanOrEqual(1);
    }
  });

  test('a subcollection names a collection it sits inside; a collection does not', () => {
    for (const row of rows) {
      if (row.kind === 'subcollection') {
        expect(row.within, row.name).toBeDefined();
        expect(rowByName.has(row.within as string), `${row.name} within ${row.within}`).toBe(true);
      } else expect(row.within, row.name).toBeUndefined();
    }
    expect(unrestrictedCollection('Prime')).toBe('Natural');
    expect(unrestrictedCollection('Permutation')).toBe('Permutation');
    expect(unrestrictedCollection('NoSuchThing')).toBe('NoSuchThing');
  });

  test('the first pass: seven rows live, everything else proposed', () => {
    for (const row of rows) {
      expect(row.status, row.name).toBe(firstPass.includes(row.name) ? 'live' : 'proposed');
    }
    expect(rows.filter((r) => r.status === 'live')).toHaveLength(firstPass.length);
  });

  test('every collection with a size parameter reads n and a bare value as it', () => {
    for (const row of rows) {
      const size = row.parameters?.find((p) => p.size);
      if (!size) continue;
      for (const spelled of [
        `${marks.segment}collection${marks.segment}${row.name}${marks.parameter}n${marks.binding}3`,
        `${marks.segment}collection${marks.segment}${row.name}${marks.parameter}3`,
      ]) {
        const read = parseAddress(spelled, '', { catalog });
        expect(read.problems, spelled).toEqual([]);
        expect(read.address.collection?.parameters, spelled).toEqual([
          { word: size.word, value: '3' },
        ]);
      }
    }
  });

  test('every route is its own canonical address', () => {
    for (const row of rows) {
      const written = `${marks.segment}collection${marks.segment}${row.name}`;
      const read = parseAddress(written, '', { catalog });
      expect(read.canonical, row.name).toBe(true);
      expect(formatAddress(read.address)).toBe(written);
    }
  });
});

describe('the route file and docs/site-map.md agree', () => {
  // Words in §4 that are properties or kinds of object, not routes.
  const notCollections = new Set([
    'Factorization',
    'JonesPolynomial',
    'AlexanderPolynomial',
    'Genus',
    'BraidWord',
    'Label',
    'Numeral',
  ]);

  test('every name §4 lists is a row', () => {
    const heads = new Set<string>();
    for (const { span, section } of codeSpans(siteMapText)) {
      if (section !== '4' || span.includes(' ') || /[…<]/.test(span)) continue;
      const m = /^[A-Z][A-Za-z]*/.exec(span);
      if (m && !notCollections.has(m[0])) heads.add(m[0]);
    }
    expect(heads.size).toBeGreaterThan(80);
    const missing = [...heads].filter((h) => !findCollection(catalog, h));
    expect(missing).toEqual([]);
  });

  test('every collection address the document writes is read without a problem', () => {
    let checked = 0;
    for (const span of exampleCollectionPaths()) {
      const head = /^[A-Z][A-Za-z]*/.exec(span)?.[0] ?? '';
      if (!findCollection(catalog, head)) continue; // `Numeral;base=60`: a property
      const read = parseAddress(`${marks.segment}collection${marks.segment}${span}`, '', {
        catalog,
      });
      expect(read.problems, span).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});
