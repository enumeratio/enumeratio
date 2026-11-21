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
  type Json,
  type RouteRow,
  type Template,
  catalog,
  collectionExpression,
  columns,
  elementExpression,
  headsIn,
  headsOf,
  identityParameters,
  isPoint,
  kinds,
  kthExpression,
  listHead,
  matchTemplate,
  measuredBindings,
  namesOf,
  noParameters,
  parametersIn,
  parseRouteFile,
  parseTemplate,
  promiseStarted,
  readElementJson,
  routeFile,
  rowByName,
  rows,
  statuses,
  unrestrictedCollection,
  valueShapes,
  valueVariable,
  writeTemplate,
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
/** A parameter's word, as the route file declares it. */
const word = (name: string, index: number): string => {
  const found = rowOf(name).parameters?.[index];
  if (!found) throw new Error(`${name} has no parameter ${index}`);
  return found.word;
};
const bind = (name: string, ...values: [number, string | number][]) =>
  values.map(([index, value]) => ({ word: word(name, index), value: String(value) }));

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
    expect(() => parseRouteFile(`${head}\n${cells({ expression: 'Foo(' })}`)).toThrow(/expression/);
    expect(() => parseRouteFile(`${head}\n${cells({ kth: 'Foo(' })}`)).toThrow(/expression/);
    expect(() => parseRouteFile(`${head}\n${cells({ kth: '7' })}`)).toThrow(/k-th/);
    expect(() => parseRouteFile(`${head}\n${cells({ kth: 'NthPrime(n)' })}`)).toThrow(/k-th/);
    expect(() => parseRouteFile(`${head}\n${cells({ kth: 'Pi' })}`)).toThrow(/k-th/);
    expect(parseRouteFile(`${head}\n${cells()}`).rows).toHaveLength(1);
  });

  test('a row’s k-th member is read, and written for a rank', () => {
    const [row] = parseRouteFile(`${columns.join('\t')}\n${cells({ kth: 'Subtract(k, 1)' })}`).rows;
    expect(row?.kth).toEqual(parseTemplate('Subtract(k, 1)'));
    expect(row && kthExpression(row, 7)).toBe('Subtract(7, 1)');
    expect(headsIn(row as RouteRow)).toEqual(['Subtract']);
    const [none] = parseRouteFile(`${columns.join('\t')}\n${cells()}`).rows;
    expect(none?.kth).toBeUndefined();
    expect(none && kthExpression(none, 7)).toBeUndefined();
  });

  test('the rows that state a k-th member are Natural and Prime', () => {
    expect(rows.filter((r) => r.kth).map((r) => r.name)).toEqual(['Natural', 'Prime']);
    expect(kthExpression(rowOf('Natural'), 7)).toBe('Subtract(7, 1)');
    expect(kthExpression(rowOf('Prime'), 4)).toBe('NthPrime(4)');
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
    expect(row?.element).toEqual(parseTemplate('Thing(x)'));
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
      const words = (row.parameters ?? []).map((p) => p.word);
      // Every parameter is named in at least one form of the expression.
      const named = new Set(row.expressions.flatMap((form) => parametersIn(row, form)));
      for (const word of words) {
        expect(named.has(word), `${row.name}: no form of the expression uses ${word}`).toBe(true);
      }
      // Every name a form uses, other than a bare symbol standing alone, is a parameter.
      for (const form of row.expressions) {
        if (form.kind === 'name') continue;
        for (const name of namesOf(form)) {
          expect(words, `${row.name}: ${name} in the expression is not a parameter`).toContain(
            name,
          );
        }
      }
      // The element is written over x and parameters only; a measure over x and nothing else.
      for (const name of namesOf(row.element as Template)) {
        const ok = name === valueVariable || words.includes(name);
        expect(ok, `${row.name}: ${name} in the element`).toBe(true);
      }
      for (const [word, measure] of row.measures) {
        expect(words, `${row.name}: a measure of ${word}`).toContain(word);
        for (const name of namesOf(measure))
          expect(name, `${row.name}: measure ${word}`).toBe(valueVariable);
      }
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

describe('templates', () => {
  const sample = 'Foo(a, [b, 12], -3)';

  test('parseTemplate reads a call, a list, a name and an integer', () => {
    expect(parseTemplate(sample)).toEqual({
      kind: 'call',
      head: 'Foo',
      args: [
        { kind: 'name', name: 'a' },
        {
          kind: 'list',
          items: [
            { kind: 'name', name: 'b' },
            { kind: 'integer', text: '12' },
          ],
        },
        { kind: 'integer', text: '-3' },
      ],
    });
    expect(parseTemplate('PrimeNumbers')).toEqual({ kind: 'name', name: 'PrimeNumbers' });
    expect(parseTemplate('Foo()')).toEqual({ kind: 'call', head: 'Foo', args: [] });
    expect(parseTemplate('[]')).toEqual({ kind: 'list', items: [] });
  });

  test('spaces are free', () => {
    expect(parseTemplate('Foo( a ,[ b,12 ],  -3 )')).toEqual(parseTemplate(sample));
  });

  test.each(['', 'Foo(', 'Foo(a b)', 'Foo(a))', '(a)', 'Foo(a,)', '[a', '1a2', 'Foo(a] '])(
    'the text “%s” is an error, not a guess',
    (text) => {
      expect(() => parseTemplate(text)).toThrow(/cannot read/);
    },
  );

  test('writeTemplate puts the text bound to a name in its place and leaves the rest', () => {
    const t = parseTemplate(sample);
    expect(writeTemplate(t, new Map())).toBe(sample);
    expect(writeTemplate(t, new Map([['a', '1']]))).toBe('Foo(1, [b, 12], -3)');
    expect(
      writeTemplate(
        t,
        new Map([
          ['a', 'Bar(2)'],
          ['b', '[3, 4]'],
        ]),
      ),
    ).toBe('Foo(Bar(2), [[3, 4], 12], -3)');
  });

  test('written and parsed again, a template is the same', () => {
    for (const row of rows) {
      for (const form of [
        ...row.expressions,
        ...(row.element ? [row.element] : []),
        ...row.measures.values(),
      ]) {
        expect(parseTemplate(writeTemplate(form, new Map())), row.name).toEqual(form);
      }
    }
  });

  test('namesOf and headsOf', () => {
    const t = parseTemplate(sample);
    expect([...namesOf(t)].toSorted()).toEqual(['a', 'b']);
    expect([...headsOf(t)]).toEqual(['Foo']);
    expect([...headsOf(parseTemplate('A(B(x), [C(y)])'))].toSorted()).toEqual(['A', 'B', 'C']);
    expect([...namesOf(parseTemplate('PrimeNumbers'))]).toEqual(['PrimeNumbers']);
    expect([...headsOf(parseTemplate('PrimeNumbers'))]).toEqual([]);
  });

  describe('matchTemplate reads an answer the way a template writes one', () => {
    const variables = new Set(['x', 'n']);

    test('a call binds its variables', () => {
      const found = matchTemplate(
        parseTemplate('Finset(Tuple(n, x))'),
        ['Finset', ['Tuple', 5, [listHead, 1, 3]]],
        variables,
      );
      expect(found?.get('n')).toBe(5);
      expect(found?.get('x')).toEqual([listHead, 1, 3]);
    });

    test('the wrong head, the wrong number of arguments, a symbol: not this shape', () => {
      const t = parseTemplate('Permutation(x)');
      expect(matchTemplate(t, ['Other', [listHead, 1]], variables)).toBeUndefined();
      expect(matchTemplate(t, ['Permutation', 1, 2], variables)).toBeUndefined();
      expect(matchTemplate(t, 'Permutation', variables)).toBeUndefined();
      expect(matchTemplate(t, 7, variables)).toBeUndefined();
    });

    test('an integer in a template matches the integer, however the kernel writes it', () => {
      const t = parseTemplate('Pair(2, x)');
      expect(matchTemplate(t, ['Pair', 2, 9], variables)?.get('x')).toBe(9);
      expect(matchTemplate(t, ['Pair', { num: '2' }, 9], variables)?.get('x')).toBe(9);
      expect(matchTemplate(t, ['Pair', 3, 9], variables)).toBeUndefined();
      expect(matchTemplate(t, ['Pair', 2.5, 9], variables)).toBeUndefined();
    });

    test('a list in a template is a List', () => {
      const t = parseTemplate('[x, n]');
      const found = matchTemplate(t, [listHead, 1, 2], variables);
      expect(found?.get('x')).toBe(1);
      expect(found?.get('n')).toBe(2);
      expect(matchTemplate(t, [listHead, 1], variables)).toBeUndefined();
      expect(matchTemplate(t, ['Tuple', 1, 2], variables)).toBeUndefined();
    });

    test('a name that is not a variable must be that symbol', () => {
      const t = parseTemplate('PrimeNumbers');
      expect(matchTemplate(t, 'PrimeNumbers', variables)).toBeDefined();
      expect(matchTemplate(t, 'Other', variables)).toBeUndefined();
    });
  });
});

describe('collectionExpression', () => {
  test('a collection with no parameters is its symbol', () => {
    expect(collectionExpression(rowOf('Natural'), [])).toEqual({
      ok: true,
      epsil: 'NonNegativeIntegers',
    });
    expect(collectionExpression(rowOf('Prime'), [])).toEqual({ ok: true, epsil: 'PrimeNumbers' });
  });

  test('the parameters bound go where the row says', () => {
    expect(collectionExpression(rowOf('Permutation'), bind('Permutation', [0, 4]))).toEqual({
      ok: true,
      epsil: 'Permutations(4)',
    });
    expect(collectionExpression(rowOf('DyckPath'), bind('DyckPath', [0, 4]))).toEqual({
      ok: true,
      epsil: 'DyckPaths(4)',
    });
  });

  test('the form whose parameters are exactly the bound ones is the one chosen', () => {
    const sets = rowOf('SetPartition');
    expect(collectionExpression(sets, bind('SetPartition', [0, 4]))).toEqual({
      ok: true,
      epsil: 'SetPartitions(4)',
    });
    expect(collectionExpression(sets, bind('SetPartition', [0, 4], [1, 2]))).toEqual({
      ok: true,
      epsil: 'SetPartitions(4, 2)',
    });
    // The order of the bindings is the address's, not the form's.
    expect(collectionExpression(sets, bind('SetPartition', [1, 2], [0, 4]))).toEqual({
      ok: true,
      epsil: 'SetPartitions(4, 2)',
    });
    expect(
      collectionExpression(rowOf('IntegerPartition'), bind('IntegerPartition', [0, 7], [1, 3])),
    ).toEqual({
      ok: true,
      epsil: 'IntegerPartitions(7, [3])',
    });
    const subsets = rowOf('Subset');
    expect(collectionExpression(subsets, bind('Subset', [0, 5], [1, 2]))).toEqual({
      ok: true,
      epsil: 'KSubsets(5, 2)',
    });
    expect(collectionExpression(subsets, bind('Subset', [0, 5]))).toEqual({
      ok: true,
      epsil: 'Subsets(5)',
    });
  });

  test('it reports what is missing', () => {
    expect(collectionExpression(rowOf('Permutation'), [])).toEqual({
      ok: false,
      missing: [word('Permutation', 0)],
    });
    expect(collectionExpression(rowOf('SetPartition'), bind('SetPartition', [1, 2]))).toEqual({
      ok: false,
      missing: [word('SetPartition', 0)],
    });
    expect(collectionExpression(rowOf('Subset'), bind('Subset', [1, 2]))).toEqual({
      ok: false,
      missing: [word('Subset', 0)],
    });
  });

  test('a parameter no form uses is not guessed at', () => {
    const result = collectionExpression(rowOf('Permutation'), [{ word: 'nonesuch', value: '3' }]);
    expect(result.ok).toBe(false);
    const extra = collectionExpression(rowOf('Natural'), bind('Subset', [0, 3]));
    expect(extra.ok).toBe(false);
  });

  test('a row with no expression has none to give', () => {
    expect(collectionExpression(rowOf('Integer'), []).ok).toBe(false);
  });

  test('isPoint: an integer, nothing else', () => {
    for (const ok of ['0', '4', '-5', '123456789012345678901234567890'])
      expect(isPoint(ok), ok).toBe(true);
    for (const no of ['', '4)', '4.5', '1e3', ' 4', 'x', "4'", '--4'])
      expect(isPoint(no), no).toBe(false);
  });
});

describe('elementExpression', () => {
  test('the value goes where x is', () => {
    expect(elementExpression(rowOf('Permutation'), [], '[3, 1, 4, 2]')).toEqual({
      ok: true,
      epsil: 'Permutation([3, 1, 4, 2])',
    });
    expect(elementExpression(rowOf('Natural'), [], '360')).toEqual({ ok: true, epsil: '360' });
    expect(elementExpression(rowOf('SetPartition'), [], '[[1, 3], [2]]')).toEqual({
      ok: true,
      epsil: 'SetPartition([[1, 3], [2]])',
    });
  });

  test('a parameter an element cannot be written without is needed, and others are not', () => {
    const subsets = rowOf('Subset');
    expect(identityParameters(subsets)).toEqual([word('Subset', 0)]);
    expect(elementExpression(subsets, bind('Subset', [0, 5]), '[1, 3]')).toEqual({
      ok: true,
      epsil: 'Finset(Tuple(5, [1, 3]))',
    });
    // k is bound in the address but is not part of the element.
    expect(elementExpression(subsets, bind('Subset', [0, 5], [1, 2]), '[1, 3]')).toEqual({
      ok: true,
      epsil: 'Finset(Tuple(5, [1, 3]))',
    });
    expect(elementExpression(subsets, bind('Subset', [1, 2]), '[1, 3]')).toEqual({
      ok: false,
      missing: [word('Subset', 0)],
    });
    expect(identityParameters(rowOf('Permutation'))).toEqual([]);
  });

  test('a row with no element constructor has none to give', () => {
    expect(elementExpression(rowOf('Integer'), [], '3')).toEqual({ ok: false, missing: [] });
    expect(identityParameters(rowOf('Integer'))).toEqual([]);
  });
});

describe('readElementJson', () => {
  const list = (...items: Json[]): Json => [listHead, ...items];

  test('a constructor’s answer is its value', () => {
    expect(readElementJson(rowOf('Permutation'), ['Permutation', list(3, 1, 4, 2)])).toEqual({
      value: list(3, 1, 4, 2),
      parameters: [],
    });
    expect(
      readElementJson(rowOf('SetPartition'), ['SetPartition', list(list(1, 3), list(2))]),
    ).toEqual({
      value: list(list(1, 3), list(2)),
      parameters: [],
    });
  });

  test('the parameters the constructor carries are read back', () => {
    expect(readElementJson(rowOf('Subset'), ['Finset', ['Tuple', 5, list(1, 3)]])).toEqual({
      value: list(1, 3),
      parameters: bind('Subset', [0, 5]),
    });
  });

  test('an answer of another shape is not an element of the row', () => {
    expect(readElementJson(rowOf('Permutation'), ['DyckPath', list(1, 0)])).toBeUndefined();
    expect(readElementJson(rowOf('Permutation'), 5)).toBeUndefined();
    expect(
      readElementJson(rowOf('Subset'), ['Finset', ['Tuple', 'five', list(1, 3)]]),
    ).toBeUndefined();
    expect(
      readElementJson(rowOf('Subset'), ['Finset', ['Tuple', 2.5, list(1, 3)]]),
    ).toBeUndefined();
    expect(readElementJson(rowOf('Integer'), 5)).toBeUndefined();
  });

  test('a number is its own element in Natural', () => {
    expect(readElementJson(rowOf('Natural'), 360)).toEqual({ value: 360, parameters: [] });
  });

  test('what elementExpression writes is read back by readElementJson', () => {
    const json = ['Finset', ['Tuple', 5, list(1, 3)]];
    const read = readElementJson(rowOf('Subset'), json);
    expect(read?.value).toEqual(list(1, 3));
    expect(read?.parameters).toEqual(bind('Subset', [0, 5]));
  });
});

describe('measuredBindings', () => {
  test('what the address binds is kept, and what an element determines is added as Epsil over it', () => {
    expect(measuredBindings(rowOf('Permutation'), [], '[3, 1, 4, 2]')).toEqual(
      bind('Permutation', [0, 'Length([3, 1, 4, 2])']),
    );
    expect(measuredBindings(rowOf('DyckPath'), [], '[1, 0]')).toEqual(
      bind('DyckPath', [0, 'Quotient(Length([1, 0]), 2)']),
    );
    expect(measuredBindings(rowOf('SetPartition'), [], '[[1], [2]]')).toEqual(
      bind('SetPartition', [0, 'Length(Flatten([[1], [2]]))'], [1, 'Length([[1], [2]])']),
    );
  });

  test('a parameter the address binds is never replaced by a measure', () => {
    expect(measuredBindings(rowOf('Permutation'), bind('Permutation', [0, 4]), '[3, 1]')).toEqual(
      bind('Permutation', [0, 4]),
    );
    expect(measuredBindings(rowOf('Subset'), bind('Subset', [0, 5]), '[1, 3]')).toEqual(
      bind('Subset', [0, 5], [1, 'Length([1, 3])']),
    );
  });

  test('a collection whose elements determine nothing keeps what is bound', () => {
    expect(measuredBindings(rowOf('Natural'), [], '360')).toEqual([]);
  });

  test('with the measures added, a collection whose address binds nothing has an expression', () => {
    for (const name of ['Permutation', 'DyckPath', 'SetPartition', 'IntegerPartition']) {
      const row = rowOf(name);
      expect(collectionExpression(row, measuredBindings(row, [], '[1]')).ok, name).toBe(true);
    }
  });

  test('heads and parameters are read from a row’s templates', () => {
    expect(headsIn(rowOf('Subset')).toSorted()).toEqual(
      ['Finset', 'KSubsets', 'Length', 'Subsets', 'Tuple'].toSorted(),
    );
    expect(headsIn(rowOf('Natural')).toSorted()).toEqual(['NonNegativeIntegers', 'Subtract']);
    expect(parametersIn(rowOf('Subset'), parseTemplate('KSubsets(n, k)'))).toEqual([
      word('Subset', 0),
      word('Subset', 1),
    ]);
  });
});
