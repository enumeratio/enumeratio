import { describe, expect, test } from 'vite-plus/test';
import {
  areas,
  dotSegments,
  formatAddress,
  marks,
  nameKey,
  parseAddress,
  pluralOf,
  readAlsoAs,
} from '../src/index.ts';
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
    path('collection', seg('Subset', ['n', 5], ['k', 2])),
    path('collection', 'Permutation', ordered(2, 1, 4, 3)),
    path('collection', 'Permutation', ordered(3, 1, 4, 2), 'Inverse', 'CycleType'),
    path('collection', 'Permutation', ordered(1, -3, 2)),
    path('collection', 'DyckPath', rank(7)),
    path('collection', 'DyckPath', rank(7, 'lex')),
    path('collection', 'Natural', rank(7)),
    path('collection', 'Prime', rank(4)),
    path('collection', 'Natural', '3811', seg('IntegerDigits', ['base', 60])),
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
    const r = read(path('collection', seg('Subset', ['n', 5])), q);
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

  test('KSubset is an alias of Subset: it redirects, with its parameters', () => {
    to(path('collection', 'Subset'))(path('collection', 'KSubset'));
    to(path('collection', seg('Subset', ['n', 5], ['k', 2])))(
      path('collection', seg('KSubset', ['n', 5], ['k', 2])),
    );
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

  test('Subset: the word is the letter, and n is the same word', () => {
    const check = to(path('collection', seg('Subset', ['n', 5], ['k', 2])));
    check(path('collection', seg('Subset', ['k', 2], ['n', 5])));
    to(path('collection', seg('Subset', ['n', 5])))(path('collection', bare('Subset', 5)));
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
      ordered(2, 1, 4, 3).replaceAll(marks.ordered, apostrophe),
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
      /^\d{2,}$/.test(raw)
        ? [...raw].join(marks.ordered)
        : raw.replace(/[[\]]/g, '').replaceAll(marks.unordered, marks.ordered);
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
    expect(refused.canonical).toBe(false);
    expect(refused.canonicalPath).toBeUndefined();
  });

  test('a notation-prefixed value: the reader gets (collection, value, notation) and the prefix is dropped', () => {
    const cycles = notation('cycle', `(${ordered(1, 2)})(${ordered(3, 4)})`);
    const seen: [string, string, string | undefined][] = [];
    const readElement = (c: string, raw: string, n?: string) => {
      seen.push([c, raw, n]);
      return n === 'cycle' ? ordered(2, 1, 4, 3) : undefined;
    };
    const r = parseAddress(path('collection', 'Permutation', cycles), '', { catalog, readElement });
    expect(seen).toEqual([['Permutation', `(${ordered(1, 2)})(${ordered(3, 4)})`, 'cycle']]);
    expect(r.address.element).toEqual({ kind: 'value', value: ordered(2, 1, 4, 3) });
    expect(r.canonical).toBe(false);
    expect(r.problems).toEqual([]);
    expect(r.canonicalPath).toBe(path('collection', 'Permutation', ordered(2, 1, 4, 3)));
  });

  test('a notation-prefixed value no reader converted is kept, read and never canonical', () => {
    const cycles = path(
      'collection',
      'Permutation',
      notation('cycle', `(${ordered(1, 2)})(${ordered(3, 4)})`),
    );
    for (const options of [
      { catalog },
      { catalog, readElement: () => undefined },
      {},
      { readElement: () => undefined },
    ]) {
      const r = parseAddress(cycles, '', options);
      expect(r.problems).toEqual([]);
      expect(r.canonical).toBe(false);
      expect(r.canonicalPath).toBe(cycles);
      expect(r.address.element).toEqual({
        kind: 'value',
        notation: 'cycle',
        value: `(${ordered(1, 2)})(${ordered(3, 4)})`,
      });
      expect(formatAddress(r.address)).toBe(cycles);
    }
  });

  test('a reader that returns null for a prefixed value refuses it', () => {
    const r = parseAddress(path('collection', 'Permutation', notation('cycle', '(1)')), '', {
      catalog,
      readElement: () => null,
    });
    expect(r.problems.map((p) => p.code)).toEqual(['unreadable-element']);
    expect(r.canonicalPath).toBeUndefined();
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

describe('/input writes what a segment may hold raw', () => {
  test('raw marks are canonical, the rest are encoded', () => {
    const raw = read(path('input', '1+1'));
    expect(raw.address.expression).toBe('1+1');
    expect(raw.canonical).toBe(true);
    const moved = read(path('input', '1%2B1'));
    expect(moved.canonical).toBe(false);
    expect(moved.canonicalPath).toBe(path('input', '1+1'));
    const mixed = read(path('input', encodeURIComponent('Area(P) = [1, 2]')));
    expect(mixed.canonicalPath).toBe(path('input', 'Area(P)%20=%20%5B1,%202%5D'));
  });
  test('a slash stays encoded', () => {
    const r = read(path('input', 'a%2Fb'));
    expect(r.address.expression).toBe('a/b');
    expect(r.canonical).toBe(true);
  });
});

const percent = (mark: string) => `%${mark.charCodeAt(0).toString(16).toUpperCase()}`;
const codes = (p: string, q = '') => read(p, q).problems.map((x) => x.code);

describe('problems mean no canonical form', () => {
  const broken = [
    ['a rank of 0', path('collection', 'DyckPath', rank(0))],
    ['an index of 0', path('collection', 'DyckPath', '1', 'Area', '0')],
    ['an unknown area', path('nonesuch', 'x')],
    ['an extra segment', path('atlas', 'x')],
    ['an unknown collection', path('collection', 'Nonesuch')],
    ['an unknown parameter', path('collection', seg('DyckPath', ['height', 3]))],
  ] as const;
  test.each(broken)('%s', (_what, p) => {
    const r = read(p);
    expect(r.problems.length).toBeGreaterThan(0);
    expect(r.canonical).toBe(false);
    expect(r.canonicalPath).toBeUndefined();
  });

  test('a fine address still has one', () => {
    expect(read(path('collection', 'DyckPath')).canonicalPath).toBe(path('collection', 'DyckPath'));
  });
});

describe('what a value may not be (§2.2)', () => {
  const dots = dotSegments;

  test('a value led by the rank sigil', () => {
    expect(codes(path('collection', 'Permutation', `${marks.rank}x1`))).toEqual(['bad-rank']);
    const prefixed = read(path('collection', 'Permutation', notation('cycle', `${marks.rank}3`)));
    expect(prefixed.problems.map((x) => x.code)).toEqual(['bad-value']);
    expect(prefixed.canonicalPath).toBeUndefined();
  });

  test('a value carrying the notation mark', () => {
    const twice = notation('cycle', notation('a', 'b'));
    const r = read(path('collection', 'Permutation', twice));
    expect(r.problems.map((x) => x.code)).toEqual(['bad-value']);
    expect(r.canonical).toBe(false);
    expect(r.canonicalPath).toBeUndefined();
    expect(codes(path('collection', 'Permutation', `1${marks.notation}2`))).toEqual(['bad-value']);
  });

  test('dot segments, as element, as collection, as property', () => {
    for (const dot of dots) {
      expect(codes(path('collection', 'Permutation', dot))).toEqual(['bad-value']);
      expect(codes(path('collection', 'Permutation', notation('cycle', dot)))).toEqual([
        'bad-value',
      ]);
      expect(codes(path('collection', dot))).toContain('bad-value');
      expect(codes(path('collection', 'Permutation', '1', dot))).toEqual(['bad-value']);
      const encoded = [...dot].map((d) => percent(d)).join('');
      expect(codes(path('collection', 'Permutation', '1', encoded))).toEqual(['bad-value']);
      expect(codes(path('collection', 'Permutation', encoded))).toEqual(['bad-value']);
    }
  });

  test('the encoder never writes them raw', () => {
    const value = (v: string, n?: string) =>
      formatAddress({
        area: areas.collection,
        collection: { name: 'Permutation', parameters: [] },
        element:
          n === undefined ? { kind: 'value', value: v } : { kind: 'value', notation: n, value: v },
        chain: [],
        query: [],
      });
    for (const dot of dots) {
      expect(value(dot)).toBe(
        path('collection', 'Permutation', [...dot].map((d) => percent(d)).join('')),
      );
    }
    expect(value(`${marks.rank}3`)).toBe(
      path('collection', 'Permutation', `${percent(marks.rank)}3`),
    );
    expect(value(`1${marks.notation}2`)).toBe(
      path('collection', 'Permutation', `1${percent(marks.notation)}2`),
    );
    // A sigil that is not the first character is raw.
    expect(value(`1${marks.rank}2`)).toBe(path('collection', 'Permutation', `1${marks.rank}2`));
    // Dots inside a value are the decimal point.
    expect(value('3.25')).toBe(path('collection', 'Permutation', '3.25'));
  });

  test('an encoded mark is read and moved to the canonical form', () => {
    for (const mark of [
      marks.unordered,
      marks.ordered,
      marks.block,
      marks.negative,
      marks.decimal,
    ]) {
      const r = read(path('collection', 'Permutation', `1${percent(mark)}2`));
      expect(r.problems).toEqual([]);
      expect(r.canonical).toBe(false);
      expect(r.canonicalPath).toBe(path('collection', 'Permutation', `1${mark}2`));
    }
    // An encoded prefix is a prefix.
    const r = read(path('collection', 'Permutation', `cycle${percent(marks.notation)}(1)`));
    expect(r.address.element).toEqual({ kind: 'value', notation: 'cycle', value: '(1)' });
    expect(r.canonical).toBe(false);
  });
});

describe('indexes', () => {
  test('an encoded digit is an index, and the address moves to the plain one', () => {
    const r = read(path('collection', 'SetPartition', '1', 'Blocks', '%32'));
    expect(r.address.chain[1]).toEqual({ kind: 'index', index: 2 });
    expect(r.canonical).toBe(false);
    expect(r.canonicalPath).toBe(path('collection', 'SetPartition', '1', 'Blocks', '2'));
  });

  test('index 0 and a negative index are refused', () => {
    expect(codes(path('collection', 'DyckPath', '1', 'Blocks', '0'))).toEqual(['bad-index']);
    const negative = `${marks.negative}1`;
    expect(codes(path('collection', 'DyckPath', '1', 'Blocks', negative))).toEqual(['bad-index']);
    expect(codes(path('collection', 'DyckPath', '1', 'Blocks', `%2D1`))).toEqual(['bad-index']);
    expect(
      read(path('collection', 'DyckPath', '1', 'Blocks', negative)).canonicalPath,
    ).toBeUndefined();
  });
});

describe('statistic and map subjects', () => {
  test('a spelling resolves by nameKey to the declared name', () => {
    for (const spelled of ['area', 'AREA']) {
      const r = read(path('stat', spelled));
      expect(r.address.subject).toBe('Area');
      expect(r.canonicalPath).toBe(path('stat', 'Area'));
      expect(r.canonical).toBe(false);
    }
    const r = read(path('stat', 'dyck_area', seg('DyckPath', ['semilength', 4])));
    expect(r.address.subject).toBe('DyckArea');
    expect(read(path('map', 'inverse')).canonicalPath).toBe(path('map', 'Inverse'));
  });

  test('an unknown subject is kept as written', () => {
    const r = read(path('stat', 'Zebra'));
    expect(r.address.subject).toBe('Zebra');
    expect(r.canonical).toBe(true);
  });

  test('without declared subjects every subject is kept as written', () => {
    const r = parseAddress(path('stat', 'area'), '', { catalog: { collections: [] } });
    expect(r.address.subject).toBe('area');
  });
});
