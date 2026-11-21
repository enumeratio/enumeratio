import { describe, expect, test } from 'vite-plus/test';
import { formatAddress, marks, nameKey, parseAddress, pluralOf, readAlsoAs } from '../src/index.ts';
import { bare, blocks, notation, ordered, path, query, rank, seg, unordered } from './build.ts';
import { catalog } from './fixtures.ts';

const read = (p: string, q = '') => parseAddress(p, q, { catalog });

describe('canonical inputs are fixed points: format(parse(x)) = x', () => {
  const canonical = [
    path(),
    path('atlas'),
    path('about'),
    path('contribute'),
    path('collection'),
    path('collection', 'DyckPath'),
    path('collection', seg('DyckPath', ['semilength', 4])),
    path('collection', seg('DyckPath', ['semilength', 4]), '11010010'),
    path('collection', 'DyckPath', '11010010', 'Area'),
    path('collection', seg('SetPartition', ['size', 4], ['blocks', 2])),
    path('collection', seg('SetPartition', ['blocks', 2])),
    path('collection', 'SetPartition', blocks(unordered(1, 3), 2, 4), 'Blocks', '2'),
    path('collection', seg('KSubset', ['n', 5], ['k', 2])),
    path('collection', 'Permutation', ordered(2, 1, 4, 3)),
    path('collection', 'Permutation', ordered(3, 1, 4, 2), 'Inverse', 'CycleType'),
    path('collection', 'Permutation', ordered(1, -3, 2)),
    path('collection', 'DyckPath', rank(7)),
    path('collection', 'DyckPath', rank(7, 'lex')),
    path('collection', 'Permutation', notation('cycle', '(1_2)(3_4)')),
    path('collection', 'Natural', '3811', seg('Numeral', ['base', 60])),
    path('collection', 'Natural', '360', 'Factorization'),
    path('collection', 'Prime', '17'),
    path('stat', 'Area'),
    path('stat', 'Area', seg('DyckPath', ['semilength', 4])),
    path('stat', 'Inversions', 'Permutation', ordered(1, 3, 2, 5, 4)),
    path('map', 'Inverse'),
    path('sequence', 'A000108'),
    path('input', 'Area(1)'),
  ];
  test.each(canonical)('%s', (p) => {
    const r = read(p);
    expect(r.canonical).toBe(true);
    expect(r.canonicalPath).toBe(p);
    expect(formatAddress(r.address)).toBe(p);
    expect(r.problems).toEqual([]);
  });

  test('a query is part of the address and keeps its order', () => {
    const q = query(['group_by', 'k']).slice(1);
    const r = read(path('collection', seg('KSubset', ['n', 5])), q);
    expect(r.canonical).toBe(true);
    expect(r.address.query).toEqual([['group_by', 'k']]);
    const two = query(['show', unordered('Area', 'Peaks')], ['order_by', 'Area']).slice(1);
    expect(read(path('collection', 'DyckPath'), two).canonical).toBe(true);
    expect(read(path('collection', 'DyckPath'), '?' + two).canonical).toBe(true);
  });
});

describe('every row of the site map §5 table', () => {
  const to = (canonical: string) => (request: string) => {
    const r = read(request);
    expect(r.canonicalPath).toBe(canonical);
    expect(r.canonical).toBe(request === canonical);
    expect(r.problems).toEqual([]);
  };

  test('/collections/…, /Collection/… : the area is lowercased; a plural redirects', () => {
    const check = to(path('collection', 'DyckPath'));
    check(path('collections', 'DyckPath'));
    check(path('Collection', 'DyckPath'));
    check(path('Collections', 'DyckPath'));
  });

  test('dyck-path, dyck_path, dyckpath : the key', () => {
    const check = to(path('collection', 'DyckPath'));
    for (const spelled of ['dyck-path', 'dyck_path', 'dyckpath', 'DYCKPATH']) {
      check(path('collection', spelled));
    }
  });

  test('DyckPaths, dyck-paths : the default plural rule', () => {
    const check = to(path('collection', 'DyckPath'));
    check(path('collection', 'DyckPaths'));
    check(path('collection', 'dyck-paths'));
  });

  test('TwinPrimes, an alias after a rename : the current name', () => {
    to(path('collection', 'TwinPrime'))(path('collection', 'TwinPrimes'));
    to(path('collection', 'Prime'))(path('collection', 'PrimeNumber'));
    to(path('collection', 'Prime'))(path('collection', 'prime-numbers'));
  });

  test('a recorded plural exception replaces the default rule', () => {
    to(path('collection', 'Simplex'))(path('collection', 'Simplices'));
    expect(read(path('collection', 'Simplexs')).problems.map((x) => x.code)).toEqual([
      'unknown-collection',
    ]);
    expect(pluralOf('Simplex', 'Simplices')).toBe('Simplices');
    expect(pluralOf('DyckPath')).toBe('DyckPaths');
  });

  test('DyckPath;n=4, ;4, _4, (4) : n and a bare value bind the size parameter', () => {
    const check = to(path('collection', seg('DyckPath', ['semilength', 4])));
    check(path('collection', seg('DyckPath', ['n', 4])));
    check(path('collection', bare('DyckPath', 4)));
    check(path('collection', `DyckPath${readAlsoAs.bareJoin}4`));
    check(path('collection', `DyckPath${readAlsoAs.bareOpen}4${readAlsoAs.bareClose}`));
    check(path('collection', seg('dyck-path', ['SemiLength', 4])));
  });

  test('KSubset: the word is the letter, and n is the same word', () => {
    const check = to(path('collection', seg('KSubset', ['n', 5], ['k', 2])));
    check(path('collection', seg('KSubset', ['k', 2], ['n', 5])));
    to(path('collection', seg('KSubset', ['n', 5])))(path('collection', bare('KSubset', 5)));
  });

  test('canonical order is the declared order; any order is read', () => {
    to(path('collection', seg('SetPartition', ['size', 4], ['blocks', 2])))(
      path('collection', seg('SetPartition', ['blocks', 2], ['n', 4])),
    );
  });

  test('Permutation element: the address layer keeps it opaque', () => {
    // Reading `2'1'4'3`, `2,1,4,3`, `[2,1,4,3]`, `2143` is the collection's
    // reader (codecs, PR 2); this layer must neither change nor reject them.
    const apostrophe = readAlsoAs.ordered[0];
    for (const spelled of [
      ordered(2, 1, 4, 3).replaceAll('_', apostrophe),
      unordered(2, 1, 4, 3),
      `[${unordered(2, 1, 4, 3)}]`,
      '2143',
    ]) {
      const r = read(path('collection', 'Permutation', encodeURIComponent(spelled)));
      expect(r.problems).toEqual([]);
      expect(r.address.element).toEqual({ kind: 'value', value: spelled });
    }
  });

  test('Permutation element: a collection reader plugs in and the change is reported', () => {
    // A stand-in reader for the mechanism only; the real one is PR 2's codec.
    const standIn = (_c: string, raw: string) =>
      /^\d{2,}$/.test(raw) ? [...raw].join('_') : raw.replace(/[[\]]/g, '').replaceAll(',', '_');
    for (const spelled of ['2143', '[2,1,4,3]', '2,1,4,3']) {
      const r = parseAddress(path('collection', 'Permutation', encodeURIComponent(spelled)), '', {
        catalog,
        readElement: standIn,
      });
      expect(r.canonical).toBe(false);
      expect(r.canonicalPath).toBe(path('collection', 'Permutation', ordered(2, 1, 4, 3)));
    }
    const refused = parseAddress(path('collection', 'IntegerPartition', '421'), '', {
      catalog,
      readElement: () => null,
    });
    expect(refused.problems.map((p) => p.code)).toEqual(['unreadable-element']);
  });

  test('/stat/St000012, /map/Mp00023, /sequence/A000108 : an outside identifier', () => {
    const names: Record<string, string> = { St000012: 'Area', Mp00023: 'Inverse' };
    const resolveSubject = (_a: string, raw: string) => names[raw];
    const stat = parseAddress(path('stat', 'St000012'), '', { catalog, resolveSubject });
    expect(stat.canonicalPath).toBe(path('stat', 'Area'));
    expect(stat.canonical).toBe(false);
    const map = parseAddress(path('map', 'Mp00023'), '', { catalog, resolveSubject });
    expect(map.canonicalPath).toBe(path('map', 'Inverse'));
    const seq = read(path('sequence', 'a000108'));
    expect(seq.canonicalPath).toBe(path('sequence', 'A000108'));
    expect(read(path('sequence', 'A000108')).canonical).toBe(true);
  });
});

describe('names', () => {
  test('nameKey drops - and _ and lowercases', () => {
    expect(nameKey('Dyck-Path')).toBe('dyckpath');
    expect(nameKey('dyck_path')).toBe('dyckpath');
    expect(nameKey('DyckPath')).toBe('dyckpath');
  });
});

describe('reporting', () => {
  test('what it changed: non-canonical input names its canonical path', () => {
    const r = read(path('collections', 'dyck-path', ''));
    expect(r.canonical).toBe(false);
    expect(r.canonicalPath).toBe(path('collection', 'DyckPath'));
  });

  test('percent-encoding of a mark is read, and written plainly', () => {
    const escaped = ordered(2, 1).replaceAll(marks.ordered, '%5F');
    const r = read(path('collection', 'Permutation', escaped));
    expect(r.canonical).toBe(false);
    expect(r.address.element).toEqual({ kind: 'value', value: ordered(2, 1) });
    expect(r.canonicalPath).toBe(path('collection', 'Permutation', ordered(2, 1)));
  });

  test('ranks, notations and indexes', () => {
    const a = read(path('collection', 'DyckPath', rank(7, 'Lex'))).address;
    expect(a.element).toEqual({ kind: 'rank', order: 'lex', rank: 7 });
    const b = read(path('collection', 'Permutation', notation('Cycle', '(1_2)'))).address;
    expect(b.element).toEqual({ kind: 'value', notation: 'cycle', value: '(1_2)' });
    const c = read(path('collection', 'SetPartition', '1', 'Blocks', '2')).address;
    expect(c.chain).toEqual([
      { kind: 'property', name: 'Blocks', parameters: [] },
      { kind: 'index', index: 2 },
    ]);
  });

  test('problems are reported, never thrown', () => {
    const codes = (p: string) => read(p).problems.map((x) => x.code);
    expect(codes(path('collection', 'Nonesuch'))).toEqual(['unknown-collection']);
    expect(codes(path('collection', seg('DyckPath', ['height', 3])))).toEqual([
      'unknown-parameter',
    ]);
    expect(codes(path('collection', seg('DyckPath', ['n', 3], ['semilength', 4])))).toEqual([
      'duplicate-parameter',
    ]);
    expect(codes(path('collection', bare('Natural', 3)))).toEqual(['no-size-parameter']);
    expect(codes(path('collection', 'DyckPath', rank(0)))).toEqual(['bad-rank']);
    expect(codes(path('collection', 'DyckPath', '1', '0'))).toEqual(['bad-index']);
    expect(codes(path('nonesuch', 'x'))).toEqual(['unknown-area']);
    expect(codes(path('atlas', 'x'))).toEqual(['extra-segment']);
    expect(codes(path('collection', 'DyckPath', '%E0%A4%A'))).toEqual(['bad-encoding']);
  });

  test('/input keeps one expression, slashes and all', () => {
    const r = read(path('input', encodeURIComponent('Divide(1/2)')));
    expect(r.address.expression).toBe('Divide(1/2)');
    expect(r.canonical).toBe(true);
  });
});
