/**
 * The computed pages held to the grammar, without a browser: for each kind of address in
 * site map §2 and §3, the Epsil the page must ask and the value it must get from the
 * kernel (one kernel for the file). Expected addresses come from the table of marks, the
 * route file and the builders; Epsil is Epsil and is written as it is. Expected values are
 * notatio's own: the reference examples of Area (the-step-word-uuddud, the-step-word-uduudd),
 * Inversions (the-one-line-word-2413), Blocks (the-partition-1-3-mid-2), and what the kernel
 * was evaluated to answer for the other heads.
 */
import { beforeAll, describe, expect, test } from 'vite-plus/test';
import {
  areas,
  formatAddress,
  formatPath,
  marks,
  notatioReference,
  queryWords,
  shapes,
} from '@enumeratio/address';
import { isServed, rowByName, rows } from '@enumeratio/routes';
import names from 'virtual:notatio-names';
import {
  blocks,
  ordered,
  path,
  query,
  rank,
  seg,
  unordered,
} from '../../packages/address/test/build.ts';
import { siteOrigin } from '../src/config.ts';
import { collectionAddress, firstSizes, sortLimit, windowSize } from '../src/live.ts';
import { type Computed, askKernel, compute, valueOf } from './harness.ts';

const deep = process.env.DEEP_TESTS === '1';

// ---------------------------------------------------------------- helpers

const cache = new Map<string, Promise<Computed>>();
/** A page computed once for the file, whichever test asks for it. */
function page(pathname: string, search = ''): Promise<Computed> {
  const key = pathname + search;
  let found = cache.get(key);
  if (!found) {
    found = compute(pathname, search);
    cache.set(key, found);
  }
  return found;
}

// The kernel loads its libraries on the first request: that is setup, not any one test.
beforeAll(async () => {
  await page(path(areas.input, '1'));
  // The libraries are declared on demand, when an expression first names one of their heads.
  await page(path(areas.input, encodeURIComponent('Count(Permutations(2))')));
  await page(path(areas.input, encodeURIComponent('FactorInteger(6)')));
});

const strip = (html: string): string =>
  html
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
const sectionText = (c: Computed, id: string): string => strip(c.sections.get(id) ?? '');
const answerTo = (c: Computed, epsil: string) => c.asked.find((a) => a.asked === epsil);
/** The asks that applied the catalogue's statistic or map of this name. */
const asksOf = (c: Computed, name: string) =>
  c.asked.filter(
    (a) => /^Combinatorial(Stat|Map)\(/.test(a.asked) && a.asked.endsWith(`, "${name}")`),
  );
const asksStarting = (c: Computed, prefix: string) =>
  c.asked.filter((a) => a.asked.startsWith(prefix));

/** A parameter's word, as the route file declares it. */
function word(name: string, index: number): string {
  const found = rowByName.get(name)?.parameters?.[index]?.word;
  if (found === undefined) throw new Error(`${name} has no parameter ${index}`);
  return found;
}
type Bound = [number, string | number][];
/** `Name;word=value…` for the parameters at these positions of the row. */
const segment = (name: string, ...bound: Bound): string =>
  seg(name, ...bound.map(([i, v]) => [word(name, i), v] as [string, string | number]));
const bindings = (name: string, bound: Bound) =>
  bound.map(([i, v]) => ({ word: word(name, i), value: String(v) }));

const inCollection = (...rest: string[]): string => path(areas.collection, ...rest);
const inStat = (...rest: string[]): string => path(areas.stat, ...rest);
const inMap = (...rest: string[]): string => path(areas.map, ...rest);
/** The object's canonical link: its address in the unrestricted collection. */
const canonicalOf = (name: string, bound: Bound, element?: string): string =>
  siteOrigin + formatPath(collectionAddress(name, bindings(name, bound), element));
const addressOf = (name: string, bound: Bound, element?: string): string =>
  formatAddress(collectionAddress(name, bindings(name, bound), element));

const list = (...names: string[]): string => names.join(marks.queryList);

/** The Dyck path 1,1,0,1,0,0,1,0 written in its shape (digits run together). */
const dyck = '11010010';
const dyckEpsil = 'DyckPath([1, 1, 0, 1, 0, 0, 1, 0])';
const setPartition = blocks(unordered(1, 3), 2, 4);

/** What a page must show when it has no value: it says so, and never shows an empty cell or a zero. */
function expectDeclined(html: string): void {
  expect(html).toContain('class="declined"');
  expect(strip(html)).toContain('not computed');
  expect(html).not.toMatch(/<code>\s*<\/code>/);
  expect(html).not.toMatch(/<td>\s*<\/td>/);
}
/** The one value a chain page leads with. */
const valueCell = (c: Computed): string | undefined =>
  /<p class="value">(.*?)<\/p>/s.exec(c.sections.get('value') ?? '')?.[1];

// ---------------------------------------------------------------- a collection

describe('unbound parameters are said once, with the picker', () => {
  test('Subset;n=5 says k is unbound, lists every subset and offers the picker', async () => {
    const c = await page(inCollection(segment('Subset', [0, 5])));
    const html = c.page.body.value;
    expect(strip(html)).toContain(`${word('Subset', 1)} is unbound`);
    expect(strip(html)).not.toContain(`${word('Subset', 0)} is unbound`);
    expect(html).toContain('data-picker="Subset"');
    expect(valueOf(c, 'Count(KSubsets(5, 0))')).toBeUndefined();
  });
  test('a collection with nothing bound names every parameter; one fully bound names none', async () => {
    const none = strip((await page(inCollection('SetPartition'))).page.body.value);
    expect(none.replaceAll(' ,', ',')).toContain(
      `${word('SetPartition', 0)}, ${word('SetPartition', 1)} are unbound`,
    );
    const all = strip(
      (await page(inCollection(segment('SetPartition', [0, 4], [1, 2])))).page.body.value,
    );
    expect(all).not.toContain('unbound');
  });
  test('a list prints on one line', async () => {
    const c = await page(inCollection('Natural', '360'));
    const text = strip(c.html);
    expect(text).toContain('[1, 2, 3, 4, 5, 6, 8, 9, 10, 12');
    expect(text).not.toMatch(/\[ |, \]/);
  });
});

describe('a collection, unbound: the counts for the first sizes', () => {
  const cases: [string, (n: number) => string, number[]][] = [
    ['Permutation', (n) => `Permutations(${n})`, [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880]],
    ['DyckPath', (n) => `DyckPaths(${n})`, [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862]],
    ['SetPartition', (n) => `SetPartitions(${n})`, [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147]],
    ['IntegerPartition', (n) => `IntegerPartitions(${n})`, [1, 1, 2, 3, 5, 7, 11, 15, 22, 30]],
    ['Subset', (n) => `Subsets(${n})`, [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]],
  ];

  test.each(cases)('%s', async (name, expression, expected) => {
    expect(expected).toHaveLength(firstSizes);
    const c = await page(inCollection(name));
    expect(c.page.found).toBe(true);
    expect(c.page.replaceWith).toBeUndefined();
    // Exactly the counts of the first sizes were asked, and no member.
    expect(c.asked.map((a) => a.asked)).toEqual(expected.map((_, n) => `Count(${expression(n)})`));
    for (const [n, count] of expected.entries()) {
      const answer = answerTo(c, `Count(${expression(n)})`);
      expect(answer?.status, `${name} ${n}`).toBe('value');
      expect(answer?.json, `${name} ${n}`).toBe(count);
    }
    // Each size links to the collection with it bound.
    const size = rowByName.get(name)?.parameters?.findIndex((p) => p.size) ?? -1;
    expect(size).toBeGreaterThanOrEqual(0);
    const counts = c.sections.get('counts') ?? '';
    expect(counts).toContain(`href="${addressOf(name, [[size, 4]])}"`);
    const oeis = rowByName.get(name)?.oeis;
    expect(oeis).toBeDefined();
    expect(counts).toContain(oeis as string);
    // The picker names each parameter by the route file's word.
    for (const [i] of (rowByName.get(name)?.parameters ?? []).entries()) {
      expect(c.page.body.value).toContain(`name="${word(name, i)}"`);
    }
  });

  test('Natural has no size to count; its members come from the row’s k-th member, and At is never asked', async () => {
    const c = await page(inCollection('Natural'), query([queryWords.show, '']));
    expect(c.sections.has('counts')).toBe(false);
    expect(valueOf(c, 'Count(NonNegativeIntegers)')).toBe('PositiveInfinity');
    expect(valueOf(c, 'Subtract(1, 1)')).toBe('0');
    expect(valueOf(c, 'Subtract(7, 1)')).toBe('6');
    // A row that states its k-th member is the catalogue stating the order: no At, no IndexOf, no Type.
    expect(asksStarting(c, 'At(')).toEqual([]);
    expect(asksStarting(c, 'IndexOf(')).toEqual([]);
    expect(asksStarting(c, 'Type(')).toEqual([]);
    expect(strip(c.sections.get('members') ?? '')).toContain('Members 1 to 20');
  });

  test('a Natural page’s kernel session logs no compilation fallback of our own question', async () => {
    // Asked of a set, At is our own incompatible-type error, and the engine logs a fallback for it.
    const warned: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      warned.push(args.map(String).join(' '));
    };
    try {
      // The members, and a rank, with no property asked: the page's own questions only.
      await compute(inCollection('Natural'), query([queryWords.show, '']));
      await compute(inCollection('Natural', rank(7)), query([queryWords.show, '']));
      await compute(inCollection('Natural', '360'), query([queryWords.show, '']));
    } finally {
      console.warn = original;
    }
    expect(warned.filter((w) => w.includes('Compilation fallback'))).toEqual([]);
  });

  test('Prime lists its first members from the row’s k-th member, one window of them', async () => {
    const c = await page(inCollection('Prime'), query([queryWords.show, '']));
    expect(valueOf(c, 'NthPrime(1)')).toBe('2');
    expect(valueOf(c, 'NthPrime(4)')).toBe('7');
    expect(asksStarting(c, 'NthPrime(').length).toBe(windowSize);
    expect(asksStarting(c, 'At(')).toEqual([]);
    expect(c.page.body.value).toContain(addressOf('Natural', []));
  });
});

describe('a collection, bound: the member table', () => {
  const dyckThree = segment('DyckPath', [0, 3]);

  test('the members, and the row’s own columns', async () => {
    const c = await page(inCollection(dyckThree));
    expect(valueOf(c, 'Count(DyckPaths(3))')).toBe('5');
    expect(asksStarting(c, 'At(DyckPaths(3), ').length).toBe(5);
    // notatio's reference: Area of the step word UUDDUD is 1 (the-step-word-uuddud), of UDUUDD 1.
    expect(valueOf(c, 'At(DyckPaths(3), 3)')).toBe('DyckPath([1, 1, 0, 0, 1, 0])');
    expect(valueOf(c, 'CombinatorialStat(DyckPath([1, 1, 0, 0, 1, 0]), "Area")')).toBe('1');
    expect(valueOf(c, 'At(DyckPaths(3), 4)')).toBe('DyckPath([1, 0, 1, 1, 0, 0])');
    expect(valueOf(c, 'CombinatorialStat(DyckPath([1, 0, 1, 1, 0, 0]), "Area")')).toBe('1');
    expect(valueOf(c, 'CombinatorialStat(DyckPath([1, 1, 1, 0, 0, 0]), "Area")')).toBe('3');
    expect(valueOf(c, 'CombinatorialStat(DyckPath([1, 0, 1, 0, 1, 0]), "Peaks")')).toBe('3');
    // Every column the row leads with, for every member.
    const columns = rowByName.get('DyckPath')?.show ?? [];
    expect(columns.length).toBeGreaterThan(0);
    for (const name of columns) {
      expect(asksOf(c, name).length, name).toBe(5);
    }
    const members = c.sections.get('members') ?? '';
    for (const name of columns) expect(members).toContain(`>${name}</a>`);
    // Each member links to its address inside this collection.
    expect(members).toContain(`href="${inCollection(dyckThree, '111000')}"`);
    expect(members).toContain(`href="${inCollection(dyckThree, '101010')}"`);
    expect(sectionText(c, 'members')).toContain('Members 1 to 5 of 5');
  });

  test('?show= changes the columns, and their order', async () => {
    const c = await page(inCollection(dyckThree), query([queryWords.show, list('Peaks', 'Area')]));
    expect(asksOf(c, 'Peaks').length).toBe(5);
    expect(asksOf(c, 'Area').length).toBe(5);
    expect(asksOf(c, 'Bounce').length).toBe(0);
    const members = c.sections.get('members') ?? '';
    expect(members.indexOf('>Peaks</a>')).toBeGreaterThan(-1);
    expect(members.indexOf('>Peaks</a>')).toBeLessThan(members.indexOf('>Area</a>'));
    expect(members).not.toContain('>Bounce</a>');
  });

  test('?order_by= sorts the table by a column', async () => {
    const c = await page(inCollection(dyckThree), query([queryWords.orderBy, 'Area']));
    const ranks = [...(c.sections.get('members') ?? '').matchAll(/<tr><td>(\d+)<\/td>/g)].map((m) =>
      Number(m[1]),
    );
    // Areas by rank are 3, 2, 1, 1, 0: ascending, ties by rank.
    expect(ranks).toEqual([5, 3, 4, 2, 1]);
    expect(sectionText(c, 'members')).toContain('Ordered by Area');
  });

  test('?order_by= on a collection too large to list whole asks for no member', async () => {
    const c = await page(
      inCollection(segment('Permutation', [0, 8])),
      query([queryWords.orderBy, 'Inversions']),
    );
    expect(c.asked.map((a) => a.asked)).toEqual(['Count(Permutations(8))']);
    expect(sectionText(c, 'members')).toContain(`the limit is ${sortLimit}`);
    expectDeclined(c.sections.get('members') ?? '');
  });

  test('?group_by=<parameter> draws a row of Pascal’s triangle', async () => {
    const c = await page(
      inCollection(segment('Subset', [0, 5])),
      query([queryWords.groupBy, word('Subset', 1)]),
    );
    const row = [1, 5, 10, 10, 5, 1];
    for (const [k, count] of row.entries()) {
      const answer = answerTo(c, `Count(KSubsets(5, ${k}))`);
      expect(answer?.status).toBe('value');
      expect(answer?.json).toBe(count);
    }
    const cells = [
      ...(c.sections.get('groups') ?? '').matchAll(
        /<tr><td><a href="([^"]*)">(\d+)<\/a><\/td><td><code>(\d+)<\/code><\/td><\/tr>/g,
      ),
    ];
    expect(cells.map((m) => [Number(m[2]), Number(m[3])])).toEqual(row.map((n, k) => [k, n]));
    // Each cell links to its own sub-collection: n bound, k bound.
    for (const [k, m] of cells.entries()) {
      expect(m[1]).toBe(
        addressOf('Subset', [
          [0, 5],
          [1, k],
        ]),
      );
    }
    expect(sectionText(c, 'groups')).not.toContain('not computed');
  });

  test('?group_by=<statistic> asks the Tally', async () => {
    const c = await page(
      inCollection(segment('DyckPath', [0, 4])),
      query([queryWords.groupBy, 'Area'], [queryWords.show, '']),
    );
    const epsil = 'Tally(CombinatorialStat(DyckPaths(4), "Area"))';
    expect(valueOf(c, epsil)).toBe('([6, 5, 4, 3, 2, 1, 0], [1, 1, 2, 3, 3, 3, 1])');
    const pairs = [
      ...(c.sections.get('groups') ?? '').matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    expect(pairs).toEqual([
      [0, 1],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 2],
      [5, 1],
      [6, 1],
    ]);
  });

  test('a group_by that is neither is a decline, and asks nothing for it', async () => {
    const c = await page(
      inCollection(segment('DyckPath', [0, 3])),
      query([queryWords.groupBy, `Nonesuch)`], [queryWords.show, '']),
    );
    expect(asked(c).some((e) => e.startsWith('Tally('))).toBe(false);
    expectDeclined(c.sections.get('groups') ?? '');
  });

  test('a large collection asks for one window of members, never for all of them', async () => {
    const c = await page(
      inCollection(segment('Permutation', [0, 8])),
      query([queryWords.show, 'Inversions']),
    );
    expect(valueOf(c, 'Count(Permutations(8))')).toBe('40_320');
    const at = asksStarting(c, 'At(');
    expect(at.length).toBeGreaterThan(0);
    expect(at.length).toBeLessThanOrEqual(windowSize);
    expect(at.map((a) => a.asked)).toEqual(
      Array.from({ length: windowSize }, (_, i) => `At(Permutations(8), ${i + 1})`),
    );
    // notatio: the first permutation is the identity.
    expect(valueOf(c, 'At(Permutations(8), 1)')).toBe('Permutation([1, 2, 3, 4, 5, 6, 7, 8])');
    expect(sectionText(c, 'members')).toContain(`Members 1 to ${windowSize} of 40320`);
    const later = /href="([^"]*)"[^>]*>Later</.exec(c.sections.get('members') ?? '')?.[1];
    expect(later).toContain(`${queryWords.from}${marks.queryBinding}${windowSize + 1}`);
  });

  test('?from= moves the window', async () => {
    const from = windowSize + 1;
    const c = await page(
      inCollection(segment('Permutation', [0, 8])),
      query([queryWords.show, 'Inversions'], [queryWords.from, String(from)]),
    );
    const at = asksStarting(c, 'At(');
    expect(at.map((a) => a.asked)).toEqual(
      Array.from({ length: windowSize }, (_, i) => `At(Permutations(8), ${from + i})`),
    );
    // The inversions of [1, 2, 3, 4, 8, 6, 5, 7]: (8,6), (8,5), (8,7), (6,5).
    expect(valueOf(c, 'At(Permutations(8), 21)')).toBe('Permutation([1, 2, 3, 4, 8, 6, 5, 7])');
    expect(
      valueOf(c, 'CombinatorialStat(Permutation([1, 2, 3, 4, 8, 6, 5, 7]), "Inversions")'),
    ).toBe('4');
    const members = c.sections.get('members') ?? '';
    expect(sectionText(c, 'members')).toContain(
      `Members ${from} to ${from + windowSize - 1} of 40320`,
    );
    expect(members).toContain('>Earlier<');
    expect(members).toContain('>Later<');
  });

  if (deep) {
    // One test for each collection and size, so a failure names the size.
    for (const name of ['Permutation', 'DyckPath', 'SetPartition', 'IntegerPartition']) {
      for (const n of [4, 5, 6, 7, 8, 9]) {
        test(`DEEP: ${name} at size ${n} lists at most one window`, async () => {
          const c = await page(inCollection(segment(name, [0, n])));
          expect(asksStarting(c, 'At(').length, `${name} ${n}`).toBeLessThanOrEqual(windowSize);
        });
      }
    }

    test('DEEP: a window near the end of a very large collection', async () => {
      const c = await page(
        inCollection(segment('Permutation', [0, 10])),
        query([queryWords.from, '3628781']),
      );
      expect(valueOf(c, 'Count(Permutations(10))')).toBe('3_628_800');
      expect(asksStarting(c, 'At(').length).toBeLessThanOrEqual(windowSize);
      expect(valueOf(c, 'At(Permutations(10), 3628800)')).toBe(
        'Permutation([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])',
      );
    });
  }
});

/** The Epsil a page asked, in order. */
const asked = (c: Computed): string[] => c.asked.map((a) => a.asked);

// ---------------------------------------------------------------- an element by value

describe('an element by value', () => {
  test('a permutation: membership is asked of the kernel, then its statistics', async () => {
    const c = await page(inCollection('Permutation', ordered(2, 1, 4, 3)));
    expect(c.page.replaceWith).toBeUndefined();
    const member = 'Element(Permutation([2, 1, 4, 3]), Permutations(Length([2, 1, 4, 3])))';
    expect(valueOf(c, member)).toBe('True');
    expect(valueOf(c, 'CombinatorialStat(Permutation([2, 1, 4, 3]), "Inversions")')).toBe('2');
    expect(valueOf(c, 'CombinatorialMap(Permutation([2, 1, 4, 3]), "CycleType")')).toBe(
      'IntegerPartition([2, 2])',
    );
    expect(valueOf(c, 'CombinatorialMap(Permutation([2, 1, 4, 3]), "Inverse")')).toBe(
      'Permutation([2, 1, 4, 3])',
    );
    // One ask for membership, shared by every section.
    expect(asked(c).filter((e) => e === member)).toHaveLength(1);
    // Every property the row leads with was asked.
    for (const name of rowByName.get('Permutation')?.show ?? []) {
      expect(asksOf(c, name).length, name).toBe(1);
    }
    expect(sectionText(c, 'membership')).toContain('true');
  });

  test('in a bound collection: its rank and its neighbors', async () => {
    const c = await page(inCollection(segment('DyckPath', [0, 4]), dyck));
    expect(valueOf(c, 'Element(' + dyckEpsil + ', DyckPaths(4))')).toBe('True');
    expect(valueOf(c, `IndexOf(DyckPaths(4), ${dyckEpsil})`)).toBe('7');
    expect(valueOf(c, 'At(DyckPaths(4), 6)')).toBe('DyckPath([1, 1, 0, 1, 0, 1, 0, 0])');
    expect(valueOf(c, 'At(DyckPaths(4), 8)')).toBe('DyckPath([1, 1, 0, 0, 1, 1, 0, 0])');
    expect(valueOf(c, `CombinatorialStat(${dyckEpsil}, "Area")`)).toBe('2');
    expect(valueOf(c, `CombinatorialStat(${dyckEpsil}, "Bounce")`)).toBe('4');
    expect(valueOf(c, `CombinatorialStat(${dyckEpsil}, "Peaks")`)).toBe('3');
    const where = c.sections.get('membership') ?? '';
    expect(strip(where)).toContain('Rank 7');
    // Its rank address, and its neighbors, inside this collection.
    const inside = segment('DyckPath', [0, 4]);
    expect(where).toContain(`href="${inCollection(inside, rank(7))}"`);
    expect(where).toContain(`href="${inCollection(inside, '110101' + '00')}"`);
    expect(where).toContain(`href="${inCollection(inside, '11001100')}"`);
  });

  test('a rank in a bound permutation collection', async () => {
    const c = await page(inCollection(segment('Permutation', [0, 4]), ordered(2, 1, 4, 3)));
    expect(valueOf(c, 'Element(Permutation([2, 1, 4, 3]), Permutations(4))')).toBe('True');
    // Lexicographic: the 6 permutations that begin with 1, then 2134 and 2143.
    expect(valueOf(c, 'IndexOf(Permutations(4), Permutation([2, 1, 4, 3]))')).toBe('8');
    expect(valueOf(c, 'At(Permutations(4), 7)')).toBe('Permutation([2, 1, 3, 4])');
    expect(valueOf(c, 'At(Permutations(4), 9)')).toBe('Permutation([2, 3, 1, 4])');
  });

  test('a sub-collection view is the unrestricted object: its canonical link is that address', async () => {
    const c = await page(inCollection(segment('DyckPath', [0, 4]), dyck));
    expect(c.page.canonical).toBe(canonicalOf('DyckPath', [], dyck));
    expect(c.page.replaceWith).toBeUndefined();
    expect(c.page.noindex).toBe(false);
    // The page says so, and links to the object.
    expect(c.sections.get('membership')).toContain(`href="${addressOf('DyckPath', [], dyck)}"`);
    expect(sectionText(c, 'membership')).toContain('view of an element of the unrestricted');
  });

  test('a member is not flagged as a non-member', async () => {
    const c = await page(inCollection('Prime', '17'));
    expect(c.nonMember).toBe(false);
  });

  test('Prime/17 is a view of Natural/17: membership in the primes, and its own canonical link', async () => {
    const c = await page(inCollection('Prime', '17'));
    expect(c.page.canonical).toBe(canonicalOf('Natural', [], '17'));
    expect(valueOf(c, 'Element(17, PrimeNumbers)')).toBe('True');
    expect(valueOf(c, 'FactorInteger(17)')).toBe('[(17, 1)]');
    expect(c.sections.get('membership')).toContain(`href="${addressOf('Natural', [], '17')}"`);
  });

  test('a non-member is not an element, and no property is computed on it', async () => {
    const forbidden = ['FactorInteger(', 'Divisors(', 'IntegerDigits(', 'Factorization('];
    const c = await page(inCollection('Prime', '18'));
    expect(valueOf(c, 'Element(18, PrimeNumbers)')).toBe('False');
    expect(c.nonMember).toBe(true);
    for (const prefix of forbidden) expect(asksStarting(c, prefix), prefix).toEqual([]);
    expect(sectionText(c, 'membership')).toContain('not an element');
    expect(sectionText(c, 'properties')).toContain('not an element');
  });

  test('a word that is no Dyck path, and a permutation with a repeated item', async () => {
    const path0101 = await page(inCollection('DyckPath', '0101'));
    expect(
      valueOf(
        path0101,
        'Element(DyckPath([0, 1, 0, 1]), DyckPaths(Quotient(Length([0, 1, 0, 1]), 2)))',
      ),
    ).toBe('False');
    expect(asksOf(path0101, 'Area')).toEqual([]);
    expect(sectionText(path0101, 'properties')).toContain('not an element');

    const repeated = await page(inCollection('Permutation', ordered(1, 1, 2)));
    expect(
      valueOf(repeated, 'Element(Permutation([1, 1, 2]), Permutations(Length([1, 1, 2])))'),
    ).toBe('False');
    for (const name of rowByName.get('Permutation')?.show ?? []) {
      expect(asksOf(repeated, name), name).toEqual([]);
    }
    expect(sectionText(repeated, 'properties')).toContain('not an element');
  });

  test('an element of the wrong sub-collection says so', async () => {
    const c = await page(inCollection(segment('DyckPath', [0, 3]), dyck));
    expect(valueOf(c, 'Element(' + dyckEpsil + ', DyckPaths(3))')).toBe('False');
    expect(asksOf(c, 'Area')).toEqual([]);
    expect(sectionText(c, 'membership')).toContain('not an element');
  });

  test('Natural: the kernel decides membership in NonNegativeIntegers, and the page goes on', async () => {
    const c = await page(inCollection('Natural', '360'));
    expect(valueOf(c, 'Element(360, NonNegativeIntegers)')).toBe('True');
    expect(sectionText(c, 'membership')).toContain('true');
    expect(valueOf(c, 'FactorInteger(360)')).toBe('[(2, 3), (3, 2), (5, 1)]');
    expect(valueOf(c, 'IntegerDigits(360)')).toBe('[3, 6, 0]');
    expect(valueOf(c, 'Factorization(360)')).toBe('Factorization(([2, 3, 5], [3, 2, 1]))');
  });

  test('a set partition and an integer partition', async () => {
    const sp = await page(inCollection('SetPartition', setPartition));
    expect(
      valueOf(
        sp,
        'Element(SetPartition([[1, 3], [2], [4]]), SetPartitions(Length(Flatten([[1, 3], [2], [4]])), Length([[1, 3], [2], [4]])))',
      ),
    ).toBe('True');
    expect(valueOf(sp, 'CombinatorialStat(SetPartition([[1, 3], [2], [4]]), "Blocks")')).toBe('3');

    const ip = await page(inCollection('IntegerPartition', ordered(4, 2, 1)));
    expect(valueOf(ip, 'CombinatorialStat(IntegerPartition([4, 2, 1]), "PartCount")')).toBe('3');
    expect(valueOf(ip, 'CombinatorialStat(IntegerPartition([4, 2, 1]), "LargestPart")')).toBe('4');
    expect(ip.page.replaceWith).toBeUndefined();
  });

  test('an integer partition’s short form is refused: 421 is one part, and is canonical', async () => {
    const c = await page(inCollection('IntegerPartition', '421'));
    expect(c.page.replaceWith).toBeUndefined();
    expect(valueOf(c, 'CombinatorialStat(IntegerPartition([421]), "PartCount")')).toBe('1');
    expect(valueOf(c, 'CombinatorialStat(IntegerPartition([421]), "LargestPart")')).toBe('421');
    expect(asked(c).some((e) => e.includes('[4, 2, 1]'))).toBe(false);
  });

  test('a non-canonical spelling moves to the canonical address', async () => {
    const canonical = inCollection('Permutation', ordered(2, 1, 4, 3));
    // §5's four spellings of one permutation (quoted from its table).
    for (const spelled of [`2'1'4'3`, '2,1,4,3', '[2,1,4,3]', '2143']) {
      const c = await page(inCollection('Permutation', spelled));
      expect(c.page.replaceWith, spelled).toBe(canonical);
      expect(c.page.canonical, spelled).toBe(siteOrigin + canonical);
      expect(
        valueOf(c, 'CombinatorialStat(Permutation([2, 1, 4, 3]), "Inversions")'),
        spelled,
      ).toBe('2');
    }
    const already = await page(canonical);
    expect(already.page.replaceWith).toBeUndefined();
  });

  test('a subset: n is kept in the object’s address, k is dropped', async () => {
    const c = await page(inCollection(segment('Subset', [0, 5], [1, 2]), unordered(1, 3)));
    expect(c.page.canonical).toBe(canonicalOf('Subset', [[0, 5]], unordered(1, 3)));
    expect(valueOf(c, 'Element(Finset(Tuple(5, [1, 3])), KSubsets(5, 2))')).toBe('True');
    // notatio: the second 2-subset of 1..5 in order.
    expect(valueOf(c, 'IndexOf(KSubsets(5, 2), Finset(Tuple(5, [1, 3])))')).toBe('2');
    expect(valueOf(c, 'At(KSubsets(5, 2), 1)')).toBe('Finset((5, [1, 2]))');
    expect(valueOf(c, 'At(KSubsets(5, 2), 3)')).toBe('Finset((5, [1, 4]))');
  });

  test('a subset with only n bound: its size is the kernel’s to measure', async () => {
    const c = await page(inCollection(segment('Subset', [0, 5]), unordered(1, 3)));
    expect(c.page.canonical).toBe(canonicalOf('Subset', [[0, 5]], unordered(1, 3)));
    expect(valueOf(c, 'Element(Finset(Tuple(5, [1, 3])), KSubsets(5, Length([1, 3])))')).toBe(
      'True',
    );
  });

  test('a subset without n cannot be written: the page says so and asks the kernel nothing', async () => {
    const c = await page(inCollection('Subset', unordered(1, 3)));
    expect(c.asked).toEqual([]);
    expect(c.page.sections ?? []).toEqual([]);
    expect(c.page.body.value).toContain(`<code>${word('Subset', 0)}</code>`);
    expectDeclined(c.page.body.value);
  });
});

// ---------------------------------------------------------------- an element by rank

describe('an element by rank', () => {
  const dyckFour = segment('DyckPath', [0, 4]);

  test('moves to the value address inside the same bound collection', async () => {
    const c = await page(inCollection(dyckFour, rank(7)));
    expect(c.movedTo).toBe(inCollection(dyckFour, dyck));
    expect(valueOf(c, 'At(DyckPaths(4), 7)')).toBe(dyckEpsil);
    expect(c.page.replaceWith).toBeUndefined();
  });

  test('a rank in Natural moves to the value: @7 is 6, by the row’s k-th member', async () => {
    const c = await page(inCollection('Natural', rank(7)));
    expect(c.movedTo).toBe(inCollection('Natural', '6'));
    expect(valueOf(c, 'Subtract(7, 1)')).toBe('6');
    expect(asksStarting(c, 'At(')).toEqual([]);
  });

  test('a rank in Prime moves to the value: @4 is 7', async () => {
    const c = await page(inCollection('Prime', rank(4)));
    expect(c.movedTo).toBe(inCollection('Prime', '7'));
  });

  test('a rank beyond the count does not move, and shows a decline', async () => {
    const c = await page(inCollection(dyckFour, rank(15)));
    expect(c.movedTo).toBeUndefined();
    expect(answerTo(c, 'At(DyckPaths(4), 15)')?.status).toBe('declined');
    expectDeclined(c.sections.get('rank') ?? '');
  });

  test('the last rank still moves', async () => {
    const c = await page(inCollection(dyckFour, rank(14)));
    expect(c.movedTo).toBe(inCollection(dyckFour, '10101010'));
  });

  test('a named order is a decline, and asks nothing', async () => {
    const c = await page(inCollection(dyckFour, rank(7, 'lex')));
    expect(c.movedTo).toBeUndefined();
    expect(c.asked).toEqual([]);
    expectDeclined(c.page.body.value);
  });

  test('a rank needs a bound collection', async () => {
    const c = await page(inCollection('DyckPath', rank(7)));
    expect(c.movedTo).toBeUndefined();
    expect(c.asked).toEqual([]);
    expectDeclined(c.page.body.value);
  });

  test('a rank in a collection of permutations moves to the permutation', async () => {
    const c = await page(inCollection(segment('Permutation', [0, 4]), rank(8)));
    expect(c.movedTo).toBe(inCollection(segment('Permutation', [0, 4]), ordered(2, 1, 4, 3)));
  });
});

// ---------------------------------------------------------------- a property chain

describe('a property chain', () => {
  const element = inCollection('Permutation', ordered(3, 1, 4, 2));

  test('through a map: the value, the Epsil, the link back, the result’s own address', async () => {
    const c = await page(`${element}${marks.segment}Inverse${marks.segment}CycleType`);
    expect(valueOf(c, 'CombinatorialMap(Permutation([3, 1, 4, 2]), "Inverse")')).toBe(
      'Permutation([2, 4, 1, 3])',
    );
    expect(valueOf(c, 'CombinatorialMap(Permutation([2, 4, 1, 3]), "CycleType")')).toBe(
      'IntegerPartition([4])',
    );
    // The whole chain, as Epsil, in the lead; the link back to the element.
    expect(c.page.body.value).toContain('CycleType(Inverse(Permutation([3, 1, 4, 2])))');
    expect(c.page.body.value).toContain(`href="${element}"`);
    const value = c.sections.get('value') ?? '';
    // The map's result links to its own address, and the chain goes on from it.
    expect(value).toContain(`href="${inCollection('Permutation', ordered(2, 4, 1, 3))}"`);
    expect(value).toContain(`href="${inCollection('IntegerPartition', '4')}"`);
    expect(strip(value)).toContain('the chain continues through it');
    // Each step has its own address, a prefix of the chain's.
    expect(value).toContain(`href="${element}${marks.segment}Inverse"`);
  });

  test('a map alone links to the element it gives', async () => {
    const c = await page(`${element}${marks.segment}Inverse`);
    expect(valueOf(c, 'CombinatorialMap(Permutation([3, 1, 4, 2]), "Inverse")')).toBe(
      'Permutation([2, 4, 1, 3])',
    );
    expect(c.sections.get('value')).toContain(
      `href="${inCollection('Permutation', ordered(2, 4, 1, 3))}"`,
    );
  });

  test('a statistic: a number, the fact as a resource', async () => {
    // notatio's reference: Inversions of the one-line word 2413 (the-one-line-word-2413).
    const c = await page(inCollection('Permutation', ordered(2, 4, 1, 3), 'Inversions'));
    expect(valueOf(c, 'CombinatorialStat(Permutation([2, 4, 1, 3]), "Inversions")')).toBe('3');
    expect(strip(valueCell(c) ?? '')).toBe('3');
    expect(c.page.body.value).toContain('Inversions(Permutation([2, 4, 1, 3]))');
  });

  test('a statistic of a Dyck path, inside a bound collection', async () => {
    const c = await page(inCollection(segment('DyckPath', [0, 4]), dyck, 'Area'));
    expect(valueOf(c, `CombinatorialStat(${dyckEpsil}, "Area")`)).toBe('2');
    expect(valueOf(c, 'Element(' + dyckEpsil + ', DyckPaths(4))')).toBe('True');
    expect(c.page.canonical).toBe(canonicalOf('DyckPath', [], dyck) + `${marks.segment}Area`);
  });

  test('a part, indexed from 1 by the next segment', async () => {
    // notatio's reference: Blocks of {1,3} | {2} is 2 (the-partition-1-3-mid-2).
    const two = await page(inCollection('SetPartition', blocks(unordered(1, 3), 2), 'Blocks'));
    expect(valueOf(two, 'CombinatorialStat(SetPartition([[1, 3], [2]]), "Blocks")')).toBe('2');
  });

  test('an index step: FactorInteger/2 of 360', async () => {
    const c = await page(inCollection('Natural', '360', 'FactorInteger', '2'));
    expect(valueOf(c, 'FactorInteger(360)')).toBe('[(2, 3), (3, 2), (5, 1)]');
    expect(valueOf(c, 'At([(2, 3), (3, 2), (5, 1)], 2)')).toBe('(3, 2)');
    expect(strip(valueCell(c) ?? '')).toContain('(3, 2)');
    expect(c.page.body.value).toContain('At(FactorInteger(360), 2)');
  });

  test('a property with a parameter: IntegerDigits;base=60 of 3811', async () => {
    const base = names.parameters.IntegerDigits?.[0];
    expect(base).toBeDefined();
    const c = await page(
      inCollection('Natural', '3811', seg('IntegerDigits', [base as string, 60])),
    );
    expect(valueOf(c, 'IntegerDigits(3811, 60)')).toBe('[1, 3, 31]');
    expect(strip(valueCell(c) ?? '')).toContain('[1, 3, 31]');
  });

  test('an unknown parameter word is a decline, not an error and not a guess', async () => {
    const c = await page(inCollection('Natural', '3811', seg('IntegerDigits', ['nonesuch', 60])));
    expect(asksStarting(c, 'IntegerDigits(')).toEqual([]);
    expect(c.asked.every((a) => a.status !== 'error')).toBe(true);
    expectDeclined(c.sections.get('value') ?? '');
    // The reason is in the decline's title.
    expect(c.sections.get('value')).toContain('has no parameter');
  });

  test('a parameter given by name but not by a point is a decline', async () => {
    const base = names.parameters.IntegerDigits?.[0] as string;
    const c = await page(inCollection('Natural', '3811', seg('IntegerDigits', [base, 'sixty'])));
    expect(asksStarting(c, 'IntegerDigits(')).toEqual([]);
    expectDeclined(c.sections.get('value') ?? '');
  });

  test('a step after a decline has no value either', async () => {
    const c = await page(inCollection('Natural', '360', 'Factorization', 'Nonesuch'));
    expectDeclined(c.sections.get('value') ?? '');
    expect(strip(valueCell(c) ?? '')).toBe('not computed');
  });
});

// ---------------------------------------------------------------- the declines

describe('a decline says so: never an empty value, never a zero', () => {
  test('Natural/360/Factorization computes: the bases and the exponents', async () => {
    const c = await page(inCollection('Natural', '360', 'Factorization'));
    expect(valueOf(c, 'Factorization(360)')).toBe('Factorization(([2, 3, 5], [3, 2, 1]))');
    expect(c.sections.get('value')).not.toContain('class="declined"');
    // FactorInteger is the kernel's value for what the map names.
    const integer = await page(inCollection('Natural', '360', 'FactorInteger'));
    expect(valueOf(integer, 'FactorInteger(360)')).toBe('[(2, 3), (3, 2), (5, 1)]');
  });

  test('SetPartition/…/Blocks/2: Blocks is a count, so there is no second block', async () => {
    const c = await page(inCollection('SetPartition', setPartition, 'Blocks', '2'));
    expect(valueOf(c, 'CombinatorialStat(SetPartition([[1, 3], [2], [4]]), "Blocks")')).toBe('3');
    expect(answerTo(c, 'At(3, 2)')?.status).toBe('declined');
    const value = c.sections.get('value') ?? '';
    expectDeclined(value);
    expect(strip(valueCell(c) ?? '')).toBe('not computed');
    expect(strip(valueCell(c) ?? '')).not.toBe('0');
  });

  test('Natural/3811/IntegerDigits;base=60 is the head’s own name, and computes', async () => {
    const base = names.parameters.IntegerDigits?.[0] as string;
    const c = await page(inCollection('Natural', '3811', seg('IntegerDigits', [base, 60])));
    expect(valueOf(c, 'IntegerDigits(3811, 60)')).toBe('[1, 3, 31]');
    expect(c.sections.get('value')).not.toContain('class="declined"');
    expect(c.page.found).toBe(true);
  });

  test('a chain of declines names each step and computes none after', async () => {
    const c = await page(inCollection('SetPartition', setPartition, 'Blocks', '2', 'Blocks'));
    expect(asksStarting(c, 'Blocks(3')).toEqual([]);
    expectDeclined(c.sections.get('value') ?? '');
  });
});

// ---------------------------------------------------------------- notatio's reference pages

const referenceOf = (shape: string, carrier: string, name: string): string =>
  notatioReference.origin + shape.replace('{carrier}', carrier).replace('{name}', name);

describe('a statistic and a map link to notatio’s reference page, one per carrier', () => {
  test('/stat/Area: the page and its DyckPath section', async () => {
    const url = referenceOf(notatioReference.statistic, 'DyckPath', 'Area');
    const unbound = await page(inStat('Area'));
    expect(unbound.page.body.value).toContain(`href="${url}"`);
    const bound = await page(inStat('Area', segment('DyckPath', [0, 4])));
    expect(bound.sections.get('reference')).toContain(`href="${url}"`);
  });

  test('/map/Inverse: the page and its Permutation section', async () => {
    const url = referenceOf(notatioReference.map, 'Permutation', 'Inverse');
    const unbound = await page(inMap('Inverse'));
    expect(unbound.page.body.value).toContain(`href="${url}"`);
    const bound = await page(inMap('Inverse', segment('Permutation', [0, 3])));
    expect(bound.sections.get('reference')).toContain(`href="${url}"`);
  });
});

// ---------------------------------------------------------------- statistics

describe('/stat', () => {
  test('a statistic as a concept: found, the collections it is on, its FindStat identity', async () => {
    const c = await page(inStat('Area'));
    expect(c.page.found).toBe(true);
    expect(c.page.noindex).toBe(false);
    expect(c.page.replaceWith).toBeUndefined();
    expect(c.page.body.value).toContain(`href="${inStat('Area', 'DyckPath')}"`);
    const ids = names.findstat.Area?.map((f) => f.id) ?? [];
    expect(ids).toContain('St000012');
    for (const id of ids) expect(c.page.body.value).toContain(id);
    expect(sectionText(c, 'definition').length).toBeGreaterThan(10);
  });

  test('a FindStat number redirects to the name', async () => {
    const c = await page(inStat('St000012'));
    expect(c.page.replaceWith).toBe(inStat('Area'));
    expect(c.page.canonical).toBe(siteOrigin + inStat('Area'));
  });

  test('narrowed to a bound collection: its distribution there', async () => {
    const c = await page(inStat('Area', segment('DyckPath', [0, 4])));
    expect(valueOf(c, 'Tally(CombinatorialStat(DyckPaths(4), "Area"))')).toBe(
      '([6, 5, 4, 3, 2, 1, 0], [1, 1, 2, 3, 3, 3, 1])',
    );
    const pairs = [
      ...(c.sections.get('groups') ?? '').matchAll(/<tr><td>(\d+)<\/td><td>(\d+)<\/td><\/tr>/g),
    ].map((m) => [Number(m[1]), Number(m[2])]);
    expect(pairs).toEqual([
      [0, 1],
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 2],
      [5, 1],
      [6, 1],
    ]);
  });

  test('narrowed to an unbound collection: it asks to bind it, and asks nothing', async () => {
    const c = await page(inStat('Area', 'DyckPath'));
    expect(c.asked).toEqual([]);
    expect(sectionText(c, 'groups')).toContain('Bind');
  });

  test('a statistic that is not on the collection is not found', async () => {
    const c = await page(inStat('Area', 'Natural'));
    expect(c.page.found).toBe(false);
    expect(c.page.noindex).toBe(true);
    expect(c.asked).toEqual([]);
  });

  test('its value on an element has one address, under the element', async () => {
    const c = await page(inStat('Inversions', 'Permutation', ordered(1, 3, 2, 5, 4)));
    const target = inCollection('Permutation', ordered(1, 3, 2, 5, 4), 'Inversions');
    expect(c.page.replaceWith).toBe(target);
    expect(c.asked).toEqual([]);
    const there = await page(target);
    expect(valueOf(there, 'CombinatorialStat(Permutation([1, 3, 2, 5, 4]), "Inversions")')).toBe(
      '2',
    );
  });

  test('an unknown statistic is not found and not indexed', async () => {
    const c = await page(inStat('Nonesuch'));
    expect(c.page.found).toBe(false);
    expect(c.page.noindex).toBe(true);
    expect(c.asked).toEqual([]);
  });
});

describe('/map', () => {
  test('a map as a concept', async () => {
    const c = await page(inMap('Inverse'));
    expect(c.page.found).toBe(true);
    expect(c.page.body.value).toContain(`href="${inMap('Inverse', 'Permutation')}"`);
    expect(c.page.body.value).toContain('Mp00066');
  });

  test('narrowed to a bound collection: the images of its members', async () => {
    const c = await page(inMap('Inverse', segment('Permutation', [0, 3])));
    expect(valueOf(c, 'Count(Permutations(3))')).toBe('6');
    expect(valueOf(c, 'At(Permutations(3), 4)')).toBe('Permutation([2, 3, 1])');
    expect(valueOf(c, 'CombinatorialMap(Permutation([2, 3, 1]), "Inverse")')).toBe(
      'Permutation([3, 1, 2])',
    );
    expect(valueOf(c, 'CombinatorialMap(Permutation([3, 1, 2]), "Inverse")')).toBe(
      'Permutation([2, 3, 1])',
    );
    const images = c.sections.get('images') ?? '';
    expect(images).toContain(`href="${inCollection('Permutation', ordered(3, 1, 2))}"`);
    expect(images).toContain(`href="${inCollection('Permutation', ordered(2, 3, 1))}"`);
  });

  test('a FindStat number redirects to the name', async () => {
    const c = await page(inMap('Mp00066'));
    expect(c.page.replaceWith).toBe(inMap('Inverse'));
  });

  test('an unknown map is not found', async () => {
    const c = await page(inMap('Nonesuch'));
    expect(c.page.found).toBe(false);
    expect(c.page.noindex).toBe(true);
  });
});

describe('/sequence', () => {
  test('A000108 redirects to the Dyck paths', async () => {
    const c = await page(path(areas.sequence, 'A000108'));
    expect(c.page.replaceWith).toBe(inCollection('DyckPath'));
    expect(c.page.found).toBe(true);
  });

  test('every live row’s OEIS number resolves to its collection', async () => {
    let checked = 0;
    for (const row of rows.filter((r) => isServed(r) && r.oeis !== undefined)) {
      const c = await page(path(areas.sequence, row.oeis as string));
      expect(c.page.replaceWith, row.name).toBe(inCollection(row.name));
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(7);
  });

  test('an unknown A-number is not found', async () => {
    const { prefix, digits } = shapes.sequenceNumber;
    const c = await page(path(areas.sequence, prefix + '9'.repeat(digits)));
    expect(c.page.found).toBe(false);
    expect(c.page.noindex).toBe(true);
    expect(c.page.replaceWith).toBeUndefined();
  });
});

// ---------------------------------------------------------------- /input

describe('/input', () => {
  const input = (expression: string) => path(areas.input, encodeURIComponent(expression));

  test('evaluates and shows the result', async () => {
    const expression = 'Area(DyckPath([1, 1, 0, 1, 0, 0, 1, 0]))';
    const c = await page(input(expression));
    expect(valueOf(c, expression)).toBe('2');
    expect(strip(valueCell(c) ?? '')).toBe('2');
    expect(c.page.body.value).toContain(expression);
    expect(c.movedTo).toBeUndefined();
  });

  test('a result that is a catalogued object is linked, not redirected to', async () => {
    const expression = 'Inverse(Permutation([2, 3, 1]))';
    const c = await page(input(expression));
    expect(valueOf(c, expression)).toBe('Permutation([3, 1, 2])');
    expect(c.sections.get('value')).toContain(
      `href="${inCollection('Permutation', ordered(3, 1, 2))}"`,
    );
    expect(strip(c.sections.get('value') ?? '')).toContain('catalogued object');
    expect(c.movedTo).toBeUndefined();
    // It stays in its area: at most the same address written in its canonical encoding.
    if (c.page.replaceWith !== undefined) {
      expect(c.page.replaceWith.startsWith(path(areas.input) + marks.segment)).toBe(true);
    }
  });

  test('a number is not a place to go', async () => {
    const c = await page(input('1 + 1'));
    expect(valueOf(c, '1 + 1')).toBe('2');
    expect(c.sections.get('value')).not.toContain('catalogued object');
  });

  test('an expression the kernel cannot read is an error the page reports, with no link', async () => {
    const c = await page(input('Area('));
    expect(answerTo(c, 'Area(')?.status).toBe('error');
    expect(strip(c.sections.get('value') ?? '')).toContain('could not read');
    expect(c.sections.get('value')).not.toContain('<a ');
    expect(c.page.found).toBe(true);
  });

  // Suspected bug in site/src/live.ts inputPage (line 959): it asks with `holds: true`, so an
  // expression the kernel leaves unevaluated is reported as a value.
  //   /input/Subsets(3) shows <code>Subsets(3)</code> as the result, with no
  //   "not computed"; expected a decline (AGENTS.md: a decline is shown as a decline).
  test('a declined expression says so', async () => {
    const c = await page(input('Subsets(3)'));
    expectDeclined(c.sections.get('value') ?? '');
  });
});

// ---------------------------------------------------------------- injection

describe('nothing written in an address becomes part of an asked expression', () => {
  // `ZZ` marks the piece; each is a value or a name that is not a point or a name.
  const pieces = ['ZZ)', encodeURIComponent('ZZ"'), `ZZ'`, 'ZZ(1)', 'ZZ;x'];
  const leaked = (c: Computed): string[] => asked(c).filter((e) => e.includes('ZZ'));

  async function none(pathname: string, search = ''): Promise<void> {
    const c = await compute(pathname, search);
    expect(leaked(c), `${pathname}${search}`).toEqual([]);
  }

  test('a collection’s parameter value, bound or not, in a table or beside a statistic or a map', async () => {
    for (const piece of pieces) {
      await none(inCollection(seg('DyckPath', [word('DyckPath', 0), piece])));
      await none(inCollection(seg('DyckPath', [word('DyckPath', 0), piece]), rank(7)));
      await none(inStat('Area', seg('DyckPath', [word('DyckPath', 0), piece])));
      await none(inMap('Inverse', seg('Permutation', [word('Permutation', 0), piece])));
      await none(inCollection(seg('Subset', [word('Subset', 0), 5], [word('Subset', 1), piece])));
    }
  });

  test('a property’s name, and a property’s parameter value', async () => {
    const base = names.parameters.IntegerDigits?.[0] as string;
    for (const piece of pieces) {
      await none(inCollection('Natural', '360', piece));
      await none(inCollection('DyckPath', dyck, piece));
      await none(inCollection('Permutation', ordered(2, 1), piece, 'Inverse'));
      await none(inCollection('Natural', '3811', seg('IntegerDigits', [base, piece])));
      await none(inCollection('Natural', '3811', seg('IntegerDigits', [piece, 60])));
      await none(inCollection('Permutation', ordered(2, 1), seg('Inversions', [base, piece])));
    }
  });

  test('a view’s query: columns, order and grouping', async () => {
    for (const piece of pieces.slice(0, 2)) {
      for (const key of [
        queryWords.show,
        queryWords.orderBy,
        queryWords.groupBy,
        queryWords.from,
      ]) {
        await none(inCollection(segment('DyckPath', [0, 1])), query([key, piece]));
      }
      await none(inCollection('Permutation', ordered(2, 1)), query([queryWords.show, piece]));
    }
  });

  // Suspected bug in site/src/live.ts planElement (lines 256-279): for an element, `place`
  // flags a parameter that is not a point, but `planElement` builds `home` and the element
  // itself from the raw bound values (`measuredBindings`, `elementExpression`), so the text
  // of the address is written into the Epsil that is asked:
  //   /collection/Permutation;size=ZZ)/2_1 asks Element(Permutation([2, 1]), Permutations(ZZ)))
  test('a parameter value that is not a point, on an element, never reaches an asked expression', async () => {
    for (const piece of pieces) {
      await none(inCollection(seg('Permutation', [word('Permutation', 0), piece]), ordered(2, 1)));
    }
  });

  test('a parameter an element cannot be written without, that is not a point, never reaches the Epsil', async () => {
    for (const piece of pieces) {
      await none(inCollection(seg('Subset', [word('Subset', 0), piece]), unordered(1, 3)));
    }
  });
});

// ---------------------------------------------------------------- a property's name is the catalogue's

describe('a property named in the catalogue is asked by its catalogue name first', () => {
  test('/collection/Subset;n=5/1,3/Sum is the statistic, not the subset back', async () => {
    const c = await page(inCollection(segment('Subset', [0, 5]), unordered(1, 3), 'Sum'));
    expect(valueOf(c, 'CombinatorialStat(Finset(Tuple(5, [1, 3])), "Sum")')).toBe('4');
    expect(asksStarting(c, 'Sum(')).toEqual([]);
    expect(valueCell(c)).toContain('4');
  });

  test('a head the catalogue does not record is applied bare', async () => {
    const c = await page(inCollection('Natural', '360', 'FactorInteger'));
    expect(asksStarting(c, 'CombinatorialStat(')).toEqual([]);
    expect(answerTo(c, 'FactorInteger(360)')?.status).toBe('value');
  });
});

describe('the two routes to a catalogued name agree, or the head declines', () => {
  // One element of each carrier, and the collection a window of more is taken from.
  const samples: Record<string, { element: string; window?: string }> = {
    Permutation: { element: 'Permutation([2, 4, 1, 3])', window: 'Permutations(4)' },
    DyckPath: { element: 'DyckPath([1, 1, 0, 1, 0, 0, 1, 0])', window: 'DyckPaths(4)' },
    SetPartition: {
      element: 'SetPartition([[1, 3], [2], [4]])',
      window: 'SetPartitions(4)',
    },
    IntegerPartition: { element: 'IntegerPartition([4, 2, 1])', window: 'IntegerPartitions(7)' },
    Finset: { element: 'Finset(Tuple(5, [1, 3]))', window: 'KSubsets(5, 2)' },
  };
  const carriers = Object.keys(names.carriers);

  test('every carrier has a sample here', () => {
    expect(carriers.filter((c) => !(c in samples))).toEqual([]);
  });

  /** Where the head answers, the catalogue's name on the same element gives the same answer. */
  async function disagreements(
    carrier: string,
    x: string,
    from: number,
    to: number,
  ): Promise<string[]> {
    const found: string[] = [];
    const entry = names.carriers[carrier];
    const heads = [
      ...(entry?.statistics ?? []).map((n) => [n, 'CombinatorialStat'] as const),
      ...(entry?.maps ?? []).map((n) => [n, 'CombinatorialMap'] as const),
    ].slice(from, to);
    for (const [head, kind] of heads) {
      const direct = await askKernel(`${head}(${x})`);
      if (direct.status !== 'value') continue;
      const named = await askKernel(`${kind}(${x}, "${head}")`);
      if (named.status !== 'value' || named.epsil !== direct.epsil) {
        found.push(
          `${carrier} ${head}(${x}): ${direct.epsil} direct, ${named.epsil ?? named.status} by name`,
        );
      }
    }
    return found;
  }

  // A disagreement is a finding for notatio, not worked around here: the page asks the catalogue
  // first, so it shows the catalogue's answer. Known pairs, each with notatio's open item:
  // `Finset Sum`: notatio's `Sum` hands a k-subset back unchanged (notatio BL-523).
  const known = new Set<string>(['Finset Sum']);
  const unknown = (found: string[]) => found.filter((f) => !known.has(f.split('(')[0] ?? f));

  // An exception outlives its bug only by mistake: once notatio fixes the pair, this fails and the
  // entry above goes.
  test('each known disagreement still disagrees', async () => {
    for (const pair of known) {
      const [carrier = '', head = ''] = pair.split(' ');
      const entry = names.carriers[carrier];
      const kind = entry?.statistics.includes(head) ? 'CombinatorialStat' : 'CombinatorialMap';
      const x = samples[carrier]?.element ?? '';
      const direct = await askKernel(`${head}(${x})`);
      const named = await askKernel(`${kind}(${x}, "${head}")`);
      expect(
        direct.status === 'value' && named.status === 'value' && direct.epsil !== named.epsil,
        pair,
      ).toBe(true);
    }
  });
  for (const carrier of Object.keys(samples)) {
    test(`${carrier}: the first few names on one element`, async () => {
      expect(unknown(await disagreements(carrier, samples[carrier]?.element ?? '', 0, 6))).toEqual(
        [],
      );
    });
  }

  // The full case: every name on its own, so that each test fits its time, on the sample and on the
  // first two members of its collection.
  for (const carrier of Object.keys(samples)) {
    const entry = names.carriers[carrier];
    const total = (entry?.statistics.length ?? 0) + (entry?.maps.length ?? 0);
    for (let at = 0; at < total; at++) {
      for (const which of [0, 1, 2]) {
        test.runIf(deep)(`${carrier}: name ${at}, element ${which}`, async () => {
          const sample = samples[carrier];
          if (sample === undefined) return;
          const member =
            which === 0 ? undefined : await askKernel(`At(${sample.window}, ${which})`);
          const x =
            which === 0 ? sample.element : member?.status === 'value' ? member.epsil : undefined;
          if (x === undefined) return;
          expect(unknown(await disagreements(carrier, x, at, at + 1))).toEqual([]);
        });
      }
    }
  }
});
