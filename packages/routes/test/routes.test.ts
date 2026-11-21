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
  type RouteRow,
  catalog,
  columns,
  isPoint,
  kinds,
  noParameters,
  parseRouteFile,
  promiseStarted,
  routeFile,
  rowByName,
  rows,
  statuses,
  unrestrictedCollection,
  valueShapes,
} from '../src/index.ts';

/** One line of a route file, built from the columns: a cell is empty unless given. */
function cells(given: Partial<Record<(typeof columns)[number], string>> = {}): string {
  const all = {
    name: 'X',
    kind: 'collection',
    status: 'live',
    requested_by: 'a',
    date: '2026-01-01',
    ...given,
  } as Record<string, string>;
  return columns.map((c) => all[c] ?? '').join('\t');
}

const rowOf = (name: string): RouteRow => {
  const row = rowByName.get(name);
  if (!row) throw new Error(`no row ${name}`);
  return row;
};

const firstPass = [
  'Natural',
  'Prime',
  'Permutation',
  'DyckPath',
  'SetPartition',
  'IntegerPartition',
  'Subset',
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
    expect(() => parseRouteFile(`${head}\n${cells({ status: 'draft' })}`)).toThrow(/status/);
    expect(() => parseRouteFile(`nonsense\n${cells()}`)).toThrow(/header/);
    expect(() => parseRouteFile(`${head}\n${cells({ kind: 'sort' })}`)).toThrow(/kind/);
    expect(() => parseRouteFile(`${head}\n${cells({ value: 'nonesuch' })}`)).toThrow(/value/);
    expect(() => parseRouteFile(`${head}\n${cells({ parameters: '?' })}`)).toThrow(/parameter/);
    expect(() => parseRouteFile(`${head}\n${cells({ measures: 'nobinding' })}`)).toThrow(/measure/);
    expect(parseRouteFile(`${head}\n${cells()}`).rows).toHaveLength(1);
  });

  test('an expression cell stays text: the route file’s reader reads none of it', () => {
    const [row] = parseRouteFile(
      `${columns.join('\t')}\n${cells({ expression: 'Foo(', kth: 'k - 1', element: 'Thing(x)' })}`,
    ).rows;
    expect(row?.expression).toBe('Foo(');
    expect(row?.expressions).toEqual(['Foo(']);
    expect(row?.kth).toBe('k - 1');
    expect(row?.element).toBe('Thing(x)');
    const [none] = parseRouteFile(`${columns.join('\t')}\n${cells()}`).rows;
    expect(none?.kth).toBeUndefined();
  });

  test('the rows that state a k-th member are Natural and Prime', () => {
    expect(rows.filter((r) => r.kth).map((r) => r.name)).toEqual(['Natural', 'Prime']);
    expect(rowOf('Natural').kth).toBe('k - 1');
    expect(rowOf('Prime').kth).toBe('NthPrime(k)');
  });

  test('a row is read from the columns, in order', () => {
    const [row] = parseRouteFile(
      `${columns.join('\t')}\n${cells({
        name: 'Thing',
        kind: 'subcollection',
        within: 'Natural',
        expression: 'Things(size, blocks) | Things(size)',
        element: 'Thing(x)',
        value: 'ordered',
        parameters: 'size*[n,len]|blocks',
        measures: 'size=Length(x)|blocks=Length(Flatten(x))',
        aliases: 'A, B',
        plural: 'Thingies',
        show: 'Area,Peaks',
        oeis: 'A000001',
        findstat: 'St000001',
      })}`,
    ).rows;
    expect(row?.name).toBe('Thing');
    expect(row?.kind).toBe('subcollection');
    expect(row?.within).toBe('Natural');
    expect(row?.expressions).toHaveLength(2);
    expect(row?.element).toBe('Thing(x)');
    expect(row?.value).toBe('ordered');
    expect(row?.parameters).toEqual([
      { word: 'size', size: true, aliases: ['n', 'len'] },
      { word: 'blocks', size: false, aliases: [] },
    ]);
    expect([...(row?.measures.keys() ?? [])]).toEqual(['size', 'blocks']);
    expect(row?.aliases).toEqual(['A', 'B']);
    expect(row?.pluralException).toBe('Thingies');
    expect(row?.show).toEqual(['Area', 'Peaks']);
    expect(row?.oeis).toBe('A000001');
    expect(row?.findstat).toBe('St000001');
  });

  test('a cell with no parameters declared differs from one that declares none', () => {
    const [undeclared] = parseRouteFile(`${columns.join('\t')}\n${cells()}`).rows;
    const [none] = parseRouteFile(
      `${columns.join('\t')}\n${cells({ parameters: noParameters })}`,
    ).rows;
    expect(undeclared?.parameters).toBeUndefined();
    expect(none?.parameters).toEqual([]);
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

  test('every stub or live row has an expression, an element, a value shape and declared parameters', () => {
    for (const row of rows.filter((r) => r.status === 'stub' || r.status === 'live')) {
      expect(row.expression, `${row.name} needs an expression`).toBeTruthy();
      expect(row.expressions.length, `${row.name} has a form`).toBeGreaterThan(0);
      expect(row.element, `${row.name} needs an element constructor`).toBeDefined();
      expect(row.value, `${row.name} needs a value shape`).toBeDefined();
      expect(
        row.parameters,
        `${row.name} needs declared parameters (${noParameters} for none)`,
      ).toBeDefined();
    }
  });

  test('every value shape named in the file is one the codecs package has', () => {
    for (const row of rows) {
      if (row.value !== undefined) expect(valueShapes, row.name).toContain(row.value);
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
      if (!findCollection(catalog, head)) continue; // `IntegerDigits;base=60`: a property
      const read = parseAddress(`${marks.segment}collection${marks.segment}${span}`, '', {
        catalog,
      });
      expect(read.problems, span).toEqual([]);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });
});

describe('renamed rows', () => {
  test('a number named by an adjective is the noun, with the adjective as its alias', () => {
    expect(rowOf('PolygonalNumber').aliases).toEqual(['Polygonal']);
    expect(rowOf('PerfectNumber').aliases).toEqual(['Perfect']);
    expect(rowOf('AbundantNumber').aliases).toEqual(['Abundant']);
    expect(rowOf('SquarefreeNumber').aliases).toEqual(['Squarefree']);
    for (const [alias, name] of [
      ['Polygonal', 'PolygonalNumber'],
      ['Perfect', 'PerfectNumber'],
      ['Abundant', 'AbundantNumber'],
      ['Squarefree', 'SquarefreeNumber'],
    ] as const) {
      expect(findCollection(catalog, alias)?.name, alias).toBe(name);
    }
  });

  test('KSubset is an alias of Subset, the one collection with n and k', () => {
    expect(rowOf('Subset').aliases).toEqual(['KSubset']);
    expect(findCollection(catalog, 'KSubset')?.name).toBe('Subset');
    expect(rows.filter((r) => r.name === 'Subset')).toHaveLength(1);
  });

  test('Prime, Semiprime and Natural are unchanged', () => {
    expect(rowOf('Prime').aliases).toEqual(['PrimeNumber']);
    expect(rowOf('Prime').within).toBe('Natural');
    expect(rowOf('Semiprime').aliases).toEqual([]);
    expect(rowOf('Semiprime').within).toBe('Natural');
    expect(rowOf('Natural').aliases).toEqual(['NaturalNumber']);
    expect(rowOf('Natural').within).toBeUndefined();
  });
});

describe('isPoint', () => {
  test('isPoint: an integer, nothing else', () => {
    for (const ok of ['0', '4', '-5', '123456789012345678901234567890'])
      expect(isPoint(ok), ok).toBe(true);
    for (const no of ['', '4)', '4.5', '1e3', ' 4', 'x', "4'", '--4'])
      expect(isPoint(no), no).toBe(false);
  });
});
