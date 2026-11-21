import { expect, test } from 'vite-plus/test';
import {
  type Address,
  type Binding,
  type Element,
  type Step,
  areas,
  formatAddress,
  marks,
  parseAddress,
  queryWords,
} from '../src/index.ts';
import { catalog } from './fixtures.ts';

/** Small by default (CI is slow); large under DEEP_TESTS=1. */
const budget = process.env.DEEP_TESTS === '1' ? 20000 : 300;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lower = 'abcdefghijklmnopqrstuvwxyz';
const upper = lower.toUpperCase();
const digits = '0123456789';
// Characters of an element value: letters and digits plus the marks that may
// occur inside a value. Never the notation mark or the rank sigil.
const valueChars =
  lower +
  upper +
  digits +
  [marks.unordered, marks.ordered, marks.block, marks.negative, marks.decimal, '+', '(', ')'].join(
    '',
  );
// Characters of anything else: add some that must be percent-encoded.
const wildChars = valueChars + ' /;=?&#%é<>[]';

function make(rand: () => number) {
  const int = (n: number) => Math.floor(rand() * n);
  const pick = <T>(xs: readonly T[]): T => xs[int(xs.length)] as T;
  const str = (chars: string, min: number, max: number) => {
    const len = min + int(max - min + 1);
    return Array.from({ length: len }, () => chars[int(chars.length)]).join('');
  };
  const word = (alphabet: string, first: string) => pick([...first]) + str(alphabet, 0, 6);
  const pascal = () => word(lower + upper + digits, upper);
  const lowerWord = () => word(lower + digits, lower);

  const element = (): Element => {
    if (rand() < 0.3) {
      const rank = 1 + int(5000);
      return rand() < 0.5 ? { kind: 'rank', rank } : { kind: 'rank', order: lowerWord(), rank };
    }
    // A value may not begin with the rank sigil, and has at least one character.
    const value = str(valueChars, 1, 12);
    return rand() < 0.3
      ? { kind: 'value', notation: lowerWord(), value }
      : { kind: 'value', value };
  };

  const chain = (): Step[] =>
    Array.from({ length: int(4) }, (): Step =>
      rand() < 0.4
        ? { kind: 'index', index: 1 + int(9) }
        : {
            kind: 'property',
            name: pascal(),
            parameters: Array.from({ length: int(3) }, (_, i) => ({
              word: `${lowerWord()}${i}`,
              value: str(wildChars, 1, 6),
            })),
          },
    );

  const query = (): [string, string][] =>
    Array.from({ length: int(4) }, (): [string, string] => [
      pick(Object.values(queryWords)),
      rand() < 0.3 ? '' : str(wildChars, 1, 8),
    ]);

  /** A collection segment against the fixture catalog: declared order, any subset bound. */
  const catalogSegment = () => {
    const spec = pick(catalog.collections);
    const parameters: Binding[] = spec.parameters
      .filter(() => rand() < 0.6)
      .map((p) => ({ word: p.word, value: str(digits + marks.negative + marks.unordered, 1, 4) }));
    return { name: spec.name, parameters };
  };
  const freeSegment = () => ({
    name: pascal(),
    parameters: Array.from({ length: int(3) }, (_, i) => ({
      word: `${lowerWord()}${i}`,
      value: str(wildChars, 1, 6),
    })),
  });

  return { int, pick, str, pascal, element, chain, query, catalogSegment, freeSegment };
}

type Gen = ReturnType<typeof make>;

function generate(g: Gen, withCatalog: boolean): Address {
  const segment = withCatalog ? g.catalogSegment : g.freeSegment;
  const query = g.query();
  const pickArea = g.pick(Object.values(areas));
  switch (pickArea) {
    case areas.collection: {
      const a: Address = { area: pickArea, chain: [], query };
      if (g.int(5) > 0) {
        a.collection = segment();
        if (g.int(4) > 0) {
          a.element = g.element();
          a.chain = g.chain();
        }
      }
      return a;
    }
    case areas.stat:
    case areas.map: {
      const a: Address = { area: pickArea, subject: g.pascal(), chain: [], query };
      if (g.int(2) > 0) {
        a.collection = segment();
        if (g.int(2) > 0) {
          a.element = g.element();
          a.chain = g.chain();
        }
      }
      return a;
    }
    case areas.sequence:
      return { area: pickArea, subject: `A${g.str('0123456789', 6, 6)}`, chain: [], query };
    case areas.input:
      return {
        area: pickArea,
        expression: g.str(wildChars + marks.segment, 1, 20),
        chain: [],
        query,
      };
    default:
      return { area: pickArea, chain: [], query };
  }
}

for (const withCatalog of [false, true]) {
  test(`sampled round trip, ${withCatalog ? 'with' : 'without'} a catalog (${budget} cases)`, () => {
    const g = make(mulberry32(withCatalog ? 7 : 11));
    const options = withCatalog ? { catalog } : {};
    for (let i = 0; i < budget; i++) {
      const address = generate(g, withCatalog);
      const written = formatAddress(address);
      const [path = '', ...q] = written.split(marks.query);
      const read = parseAddress(path, q.join(marks.query), options);
      expect(read.problems, written).toEqual([]);
      expect(read.address, written).toEqual(address);
      expect(read.canonical, written).toBe(true);
      expect(formatAddress(read.address), written).toBe(written);
    }
  });
}

test('the root and the leaf areas', () => {
  for (const area of [areas.atlas, areas.about, areas.contribute]) {
    const written = formatAddress({ area, chain: [], query: [] });
    expect(parseAddress(written).canonical).toBe(true);
  }
  expect(formatAddress({ area: '', chain: [], query: [] })).toBe(marks.segment);
});
