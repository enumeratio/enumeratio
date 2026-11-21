import { beforeAll, describe, expect, test } from 'vite-plus/test';
import { areas } from '@enumeratio/address';
import { kthExpression } from '@enumeratio/kernel/expressions';
import { rowByName } from '@enumeratio/routes';
import { path } from '../../packages/address/test/build.ts';
import {
  defaultLimits,
  rankSearchEvaluations,
  rankSearchTimeMs,
  searchRank,
} from '../src/rank-search.ts';
import { askKernel, compute } from './harness.ts';

const deep = process.env.DEEP_TESTS === '1';

/** The search over the members of a row, asked of the kernel. */
async function searchRow(name: string, target: number) {
  const row = rowByName.get(name);
  if (!row) throw new Error(`no row ${name}`);
  const started = Date.now();
  const found = await searchRank(async (k) => {
    const answer = await askKernel(kthExpression(row, k) as string);
    return typeof answer.json === 'number' ? answer.json : undefined;
  }, target);
  return { ...found, ms: Date.now() - started };
}

beforeAll(async () => {
  // The libraries load on the first request that names one of their heads: setup, not a test.
  await askKernel('NthPrime(1)');
  await askKernel('Element(2, PrimeNumbers)');
});

describe('the bounded rank search, with members it is given', () => {
  const triples = async (k: number): Promise<number | undefined> => 3 * k;

  test('its asks grow with the logarithm of the rank', async () => {
    for (const rank of [1, 2, 1000, 1_000_000_000]) {
      const found = await searchRank(triples, 3 * rank);
      expect(found.rank).toBe(rank);
      expect(found.evaluations, `rank ${rank}`).toBeLessThanOrEqual(
        2 * Math.ceil(Math.log2(rank)) + 3,
      );
    }
  });

  test('the caps are named, and a rank a number can name fits under the evaluations cap', async () => {
    expect(defaultLimits.evaluations).toBe(rankSearchEvaluations);
    expect(defaultLimits.timeMs).toBe(rankSearchTimeMs);
    const found = await searchRank(triples, 3 * 2 ** 50);
    expect(found.rank).toBe(2 ** 50);
    expect(found.evaluations).toBeLessThan(rankSearchEvaluations);
  });

  test('a non-member between two members ends, and has no rank', async () => {
    const found = await searchRank(triples, 3 * 500 + 1);
    expect(found.rank).toBeUndefined();
    expect(found.reason).toContain('not a member');
    expect(found.evaluations).toBeLessThan(40);
  });

  test('a target below the first member, and one past every member, end', async () => {
    expect((await searchRank(triples, 1)).rank).toBeUndefined();
    const few = async (k: number): Promise<number | undefined> => (k <= 10 ? 3 * k : undefined);
    const found = await searchRank(few, 3 * 11);
    expect(found.rank).toBeUndefined();
    expect(found.reason).toContain('declines');
  });

  test('past the cap on evaluations the rank is not found, and the search stops there', async () => {
    let asked = 0;
    const found = await searchRank(
      async (k) => {
        asked++;
        return 3 * k;
      },
      3 * 1_000_000,
      { ...defaultLimits, evaluations: 5 },
    );
    expect(found.rank).toBeUndefined();
    expect(found.reason).toContain('5 asks');
    expect(asked).toBe(5);
    expect(found.evaluations).toBe(5);
  });

  test('past the cap on wall time the rank is not found, and the search stops there', async () => {
    let clock = 0;
    let asked = 0;
    const found = await searchRank(
      async (k) => {
        asked++;
        clock += 100; // each member takes 100 ms
        return 3 * k;
      },
      3 * 1_000_000,
      { evaluations: 1000, timeMs: 450, now: () => clock },
    );
    expect(found.rank).toBeUndefined();
    expect(found.reason).toContain('450 ms');
    // Checked between asks: 5 asks take 500 ms, so the sixth is never made.
    expect(asked).toBe(5);
  });

  test('a member the kernel declines ends the search', async () => {
    const found = await searchRank(async () => undefined, 7);
    expect(found.rank).toBeUndefined();
    expect(found.evaluations).toBe(1);
  });
});

describe('the bounded rank search, with the kernel and the route file’s k-th members', () => {
  test('a natural: 5 is the 6th member', async () => {
    expect((await searchRow('Natural', 5)).rank).toBe(6);
    expect((await searchRow('Natural', 0)).rank).toBe(1);
  });

  test('a large natural: 1000000000 is member 1000000001', async () => {
    const found = await searchRow('Natural', 1_000_000_000);
    expect(found.rank).toBe(1_000_000_001);
    expect(found.evaluations).toBeLessThanOrEqual(64);
  });

  test('a large prime, small case: 1299709 is the 100000th prime', async () => {
    const found = await searchRow('Prime', 1_299_709);
    expect(found.rank).toBe(100_000);
    expect(found.evaluations).toBeLessThanOrEqual(40);
  });

  test('a non-member between two members ends: 18 lies between 17 and 19', async () => {
    const found = await searchRow('Prime', 18);
    expect(found.rank).toBeUndefined();
    expect(found.reason).toContain('not a member');
    expect(found.evaluations).toBeLessThanOrEqual(10);
  });

  test('the page for a natural gives its rank, and asks neither At nor IndexOf', async () => {
    const c = await compute(path(areas.collection, 'Natural', '100000'));
    expect(c.sections.get('membership') ?? '').toContain('Rank 100001');
    expect(c.asked.filter((a) => /^(At|IndexOf)\(/.test(a.asked))).toEqual([]);
  });

  if (deep) {
    test('DEEP: a large prime, 999999937, is the 50847534th', async () => {
      const found = await searchRow('Prime', 999_999_937);
      expect(found.rank).toBe(50_847_534);
      expect(found.evaluations).toBeLessThanOrEqual(64);
    });

    test('DEEP: a non-member near a large prime ends', async () => {
      const found = await searchRow('Prime', 1_000_000_000);
      expect(found.rank).toBeUndefined();
      expect(found.reason).toContain('not a member');
    });

    test('DEEP: the page for a large natural gives its rank', async () => {
      const c = await compute(path(areas.collection, 'Natural', '1000000000'));
      expect(c.sections.get('membership') ?? '').toContain('Rank 1000000001');
      expect(c.asked.filter((a) => /^(At|IndexOf)\(/.test(a.asked))).toEqual([]);
    });

    test('DEEP: the page for a large prime gives its rank', async () => {
      const c = await compute(path(areas.collection, 'Prime', '999999937'));
      expect(c.sections.get('membership') ?? '').toContain('Rank 50847534');
    });
  }
});
