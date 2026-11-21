import { beforeAll, describe, expect, test } from 'vite-plus/test';
import { type Binding, marks } from '@enumeratio/address';
import { plain, sameJson } from '@enumeratio/kernel';
import {
  collectionExpression,
  elementExpression,
  givenOf,
  measuredBindings,
  readElementJson,
} from '@enumeratio/kernel/expressions';
import { createNodeKernel } from '@enumeratio/kernel/node';
import { type RouteRow, rowByName } from '@enumeratio/routes';
import { codecs, itemsFromJson, itemsToJson } from '../src/index.ts';

/**
 * The codec and the kernel against each other, over every element of the small collections:
 * what the kernel enumerates is written and read back to the same element. One kernel for
 * the file (its first request loads the libraries).
 */
const { ask, askText } = createNodeKernel();

// The libraries load on the first request that names one of their heads: setup, not a test.
beforeAll(async () => {
  for (const epsil of [
    'Count(Permutations(2))',
    'Count(DyckPaths(2))',
    'Count(SetPartitions(2))',
    'Count(IntegerPartitions(2))',
    'Count(KSubsets(2, 1))',
    'Element(Finset(Tuple(2, [1])), KSubsets(2, 1))',
  ]) {
    await askText(epsil);
  }
});

const deep = process.env.DEEP_TESTS === '1';

/**
 * The timeout, in milliseconds, of one collection at one size under `DEEP_TESTS=1` (the standard
 * run keeps the default timeout and its small sizes). The case that needs it is Permutation at
 * size 6: its 720 elements take about 6.3 s on the development machine (up to 7.3 s), and a
 * continuous-integration runner is about six times slower, so about 40 s. This leaves room above
 * that for one more size at that rate, and no single test grows with the budget: each test is one
 * collection at one size.
 */
const deepTimeoutMs = 60_000;
const sweepOptions = deep ? { timeout: deepTimeoutMs } : {};

const sizes = deep ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
const subsetSizes = deep ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4];

const rowOf = (name: string): RouteRow => {
  const row = rowByName.get(name);
  if (!row) throw new Error(`no row ${name}`);
  return row;
};
const sizeWord = (row: RouteRow): string => {
  const size = row.parameters?.find((p) => p.size);
  if (!size) throw new Error(`${row.name} has no size parameter`);
  return size.word;
};
const otherWord = (row: RouteRow): string => {
  const other = row.parameters?.find((p) => !p.size);
  if (!other) throw new Error(`${row.name} has no second parameter`);
  return other.word;
};

/** Each live collection that has parameters, with the bindings of every small collection of it. */
function cases(): { row: RouteRow; bound: Binding[] }[] {
  const out: { row: RouteRow; bound: Binding[] }[] = [];
  for (const name of ['Permutation', 'DyckPath', 'SetPartition', 'IntegerPartition']) {
    const row = rowOf(name);
    for (const n of sizes) out.push({ row, bound: [{ word: sizeWord(row), value: String(n) }] });
  }
  const subset = rowOf('Subset');
  for (const n of subsetSizes) {
    for (let k = 1; k <= n; k++) {
      out.push({
        row: subset,
        bound: [
          { word: sizeWord(subset), value: String(n) },
          { word: otherWord(subset), value: String(k) },
        ],
      });
    }
  }
  return out;
}

const countOf = (json: unknown): number => {
  if (typeof json !== 'number') throw new Error(`not a count: ${JSON.stringify(json)}`);
  return json;
};

interface Sweep {
  elements: number;
  skipped: number;
  spellings: Set<string>;
}

async function sweep(row: RouteRow, bound: Binding[]): Promise<Sweep> {
  const codec = codecs[row.value as keyof typeof codecs];
  const where = `${row.name} ${JSON.stringify(bound)}`;
  const collection = collectionExpression(row, givenOf(bound));
  if (!collection.ok) throw new Error(`${where}: no expression`);
  const count = await ask(['Count', collection.json]);
  expect(count.status, where).toBe('value');
  const total = countOf(count.json);
  const out: Sweep = { elements: total, skipped: 0, spellings: new Set() };
  for (let i = 1; i <= total; i++) {
    const at = await ask(['At', collection.json, i]);
    expect(at.status, `${where} At ${i}`).toBe('value');
    const read = readElementJson(row, at.json);
    expect(read, `${where} #${i} is an element of the row`).toBeDefined();
    if (!read) continue;
    const items = itemsFromJson(read.value);
    expect(items, `${where} #${i} has a value`).toBeDefined();
    if (items === undefined) continue;
    const s = codec.write(items);
    if (s === null) {
      // The only element without a spelling is the empty one.
      expect(items, `${where} #${i} has no spelling and is not empty`).toEqual([]);
      out.skipped++;
      continue;
    }
    out.spellings.add(s);
    const back = codec.read(s);
    expect(back, `${where}: ${s} is read`).not.toBeNull();
    if (back === null) continue;
    expect(codec.write(back), `${where}: write(read(${s}))`).toBe(s);
    const expressed = elementExpression(row, givenOf(read.parameters), itemsToJson(back));
    expect(expressed.ok, `${where}: ${s} has an expression`).toBe(true);
    if (!expressed.ok) continue;
    const again = await ask(expressed.json, { holds: true });
    expect(again.status, `${where}: ${again.asked}`).toBe('value');
    expect(
      sameJson(plain(again.json), plain(at.json)),
      `${where}: read(write(x)) is x for ${s}: ${JSON.stringify(again.json)} against ${JSON.stringify(at.json)}`,
    ).toBe(true);
  }
  return out;
}

describe('every element of the small collections is written and read back', () => {
  const live = ['Permutation', 'DyckPath', 'SetPartition', 'IntegerPartition', 'Subset'];

  // One test for each collection and size, so a failure names the size.
  for (const name of live) {
    const mine = cases().filter((c) => c.row.name === name);
    test(`${name} has cases`, () => {
      expect(mine.length).toBeGreaterThan(0);
    });
    for (const { row, bound } of mine) {
      const label = bound.map((b) => `${b.word}=${b.value}`).join(', ');
      test(`${name}, ${label}`, sweepOptions, async () => {
        const result = await sweep(row, bound);
        expect(result.skipped, `${name} ${label}: only the empty element is skipped`).toBe(0);
        // Distinct elements get distinct strings.
        expect(result.spellings.size, `${name} ${label}`).toBe(result.elements);
      });
    }
  }

  test('the empty element is the only one without a spelling', async () => {
    // Size 0: each collection has exactly one element, the empty one, which no codec writes.
    for (const name of ['Permutation', 'DyckPath', 'SetPartition', 'IntegerPartition']) {
      const row = rowOf(name);
      const result = await sweep(row, [{ word: sizeWord(row), value: '0' }]);
      expect(result.elements, name).toBe(1);
      expect(result.skipped, name).toBe(1);
      expect(result.spellings.size, name).toBe(0);
    }
  });
});

describe('membership is the kernel’s, not the codec’s', () => {
  /** The test the page asks: what the address binds, and what the element itself determines. */
  async function member(name: string, raw: string, bound: Binding[] = []): Promise<unknown> {
    const row = rowOf(name);
    const codec = codecs[row.value as keyof typeof codecs];
    const items = codec.read(raw);
    expect(items, `${name}: ${raw} is read`).not.toBeNull();
    if (items === null) return undefined;
    const value = itemsToJson(items);
    const element = elementExpression(row, givenOf(bound), value);
    if (!element.ok) throw new Error(`no element expression for ${name}`);
    const home = collectionExpression(row, measuredBindings(row, givenOf(bound), value));
    if (!home.ok) throw new Error(`no collection expression for ${name}`);
    const answer = await ask(['Element', element.json, home.json]);
    expect(answer.status, `${name} ${raw}`).toBe('value');
    return answer.json;
  }

  test('an ordered value with a repeated item is read by the codec and is no permutation', async () => {
    const repeated = [1, 1, 2].join(marks.ordered);
    expect(codecs.ordered.read(repeated)).toEqual(['1', '1', '2']);
    expect(await member('Permutation', repeated)).toBe('False');
  });

  test('a permutation is one', async () => {
    expect(await member('Permutation', [3, 1, 4, 2].join(marks.ordered))).toBe('True');
  });

  test('a word that is not a Dyck path is read and is no Dyck path', async () => {
    expect(codecs.digits.read('0101')).toEqual(['0', '1', '0', '1']);
    expect(await member('DyckPath', '0101')).toBe('False');
    expect(await member('DyckPath', '1010')).toBe('True');
  });

  test('parts out of order are read and are no integer partition', async () => {
    const wrong = [1, 2].join(marks.ordered);
    expect(codecs.parts.read(wrong)).toEqual(['1', '2']);
    expect(await member('IntegerPartition', wrong)).toBe('False');
  });

  test('a subset with a member beyond n is read and is no subset of 1..n', async () => {
    const row = rowOf('Subset');
    const n: Binding = { word: sizeWord(row), value: '3' };
    expect(codecs.unordered.read([1, 5].join(marks.unordered))).toEqual(['1', '5']);
    expect(await member('Subset', [1, 5].join(marks.unordered), [n])).toBe('False');
    expect(await member('Subset', [1, 3].join(marks.unordered), [n])).toBe('True');
  });
});
