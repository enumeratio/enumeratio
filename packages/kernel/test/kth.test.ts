import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, test } from 'vite-plus/test';
import { collectionExpression, kthExpression, rows } from '@enumeratio/routes';
import { createNodeKernel } from '../src/node.ts';

/**
 * A row that states its k-th member (route file, `kth`): the k-th member is an element of
 * the collection, the members increase, and none is skipped. The first members are checked
 * against notatio's own records, read from the installed package.
 */
const deep = process.env.DEEP_TESTS === '1';
const kernel = createNodeKernel();
const stating = rows.filter((r) => r.kth !== undefined);

/** How many first members are checked: a few in the standard case, more under DEEP_TESTS. */
const count = deep ? 60 : 8;

const integerOf = (json: unknown): number => {
  if (typeof json !== 'number') throw new Error(`not an integer: ${JSON.stringify(json)}`);
  return json;
};

/** A reference example of notatio's, by its row id, read from the installed package's records. */
function referenceExpected(pkg: string, head: string, id: string): string {
  const installed = fileURLToPath(new URL(`../node_modules/${pkg}/`, import.meta.url));
  const lines = readFileSync(join(installed, 'reference', head, 'examples.tsv'), 'utf8').split(
    '\n',
  );
  const header = (lines[0] as string).split('\t');
  const line = lines.find((l) => l.startsWith(`${id}\t`));
  if (!line) throw new Error(`no example ${id} in ${head}`);
  return line.split('\t')[header.indexOf('expected')] as string;
}

beforeAll(async () => {
  // The kernel loads its libraries on the first request: that is setup, not any one test.
  await kernel('NthPrime(1)');
  await kernel('Element(2, PrimeNumbers)');
});

describe('a row’s k-th member', () => {
  test('there are rows that state one', () => {
    expect(stating.map((r) => r.name)).toEqual(['Natural', 'Prime']);
  });

  for (const row of stating) {
    describe(row.name, () => {
      const collection = (): string => {
        const expressed = collectionExpression(row, []);
        if (!expressed.ok) throw new Error(`${row.name} has no collection expression`);
        return expressed.epsil;
      };
      const members = async (): Promise<number[]> => {
        const out: number[] = [];
        for (let k = 1; k <= count; k++) {
          const answer = await kernel(kthExpression(row, k) as string);
          expect(answer.status, `${row.name} member ${k}`).toBe('value');
          out.push(integerOf(answer.json));
        }
        return out;
      };

      test('each of the first members is an element of the collection', async () => {
        for (const [i, member] of (await members()).entries()) {
          const answer = await kernel(`Element(${member}, ${collection()})`);
          expect(answer.json, `member ${i + 1} = ${member}`).toBe('True');
        }
      });

      test('the members increase, and none is skipped', async () => {
        const listed = await members();
        for (const [i, member] of listed.entries()) {
          if (i === 0) continue;
          const before = listed[i - 1] as number;
          expect(member, `member ${i + 1}`).toBeGreaterThan(before);
          for (let between = before + 1; between < member; between++) {
            const answer = await kernel(`Element(${between}, ${collection()})`);
            expect(answer.json, `${between} lies between members ${i} and ${i + 1}`).toBe('False');
          }
        }
      });
    });
  }

  test('Natural is exactly 0, 1, 2, …', async () => {
    const row = stating.find((r) => r.name === 'Natural');
    for (let k = 1; k <= count; k++) {
      const answer = await kernel(kthExpression(row as never, k) as string);
      expect(answer.json).toBe(k - 1);
    }
  });

  test('Prime is the first primes of notatio’s reference examples', async () => {
    const row = stating.find((r) => r.name === 'Prime');
    // The 25 primes below 100, from NthPrime's reference example in the installed records.
    const expected = referenceExpected(
      '@notatio/number-theory',
      'PrimePi',
      'nthprime-range-1-primepi-100',
    )
      .replace(/^\[List,\s*/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((n) => Number(n.trim()));
    expect(expected.length).toBe(25);
    const wanted = deep ? expected : expected.slice(0, 8);
    for (const [i, prime] of wanted.entries()) {
      const answer = await kernel(kthExpression(row as never, i + 1) as string);
      expect(answer.json, `prime ${i + 1}`).toBe(prime);
    }
  });
});
