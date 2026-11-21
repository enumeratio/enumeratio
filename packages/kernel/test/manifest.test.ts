import { symbolInfo } from '@notatio/manifest';
import { describe, expect, test } from 'vite-plus/test';
import { rows, valueShapes } from '@enumeratio/routes';
import { codecs } from '../../codecs/src/index.ts';
import { collectNotatioData } from '../src/data-plugin.ts';
import { elementHeadOf, headsOfRow } from '../src/cell.ts';
import { parseCell } from '../src/parse-cells.ts';

/**
 * What the route file names is checked against the pinned notatio. A name that is in the
 * route file on purpose although notatio lacks it goes here, with the reason. A head that
 * is in the manifest and still does not evaluate as the site map wants is a different
 * matter: the page tests in site/test/live.test.ts hold the pages to it.
 */
const knownAbsent: Record<string, string> = {};

const served = rows.filter((r) => r.status === 'live' || r.status === 'stub');

describe('the route file against the pinned notatio manifest', () => {
  test('there are live rows to check', () => {
    expect(served.length).toBeGreaterThanOrEqual(7);
  });

  test('every head named in an expression, element, measure or show cell is in the manifest', () => {
    const missing: string[] = [];
    for (const row of served) {
      const named = new Set([...headsOfRow(row, parseCell), ...row.show]);
      for (const name of named) {
        if (name in knownAbsent) continue;
        if (symbolInfo(name) === undefined) missing.push(`${row.name}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  test('the list of known absences is used', () => {
    for (const name of Object.keys(knownAbsent)) {
      expect(
        symbolInfo(name),
        `${name} is now in the manifest: remove it from the list`,
      ).toBeUndefined();
    }
  });
});

describe('the route file is complete for what it serves', () => {
  test('every value shape named in the route file has a codec', () => {
    for (const shape of valueShapes) expect(codecs, shape).toHaveProperty(shape);
    for (const row of rows) {
      if (row.value !== undefined) expect(Object.keys(codecs), row.name).toContain(row.value);
    }
  });

  test('every live row has expressions, an element constructor and a value shape', () => {
    for (const row of rows.filter((r) => r.status === 'live')) {
      expect(row.expressions.length, `${row.name} expressions`).toBeGreaterThan(0);
      expect(row.element, `${row.name} element`).toBeDefined();
      expect(row.value, `${row.name} value`).toBeDefined();
    }
  });
});

describe('what the pages know of notatio comes from notatio', () => {
  const { names } = collectNotatioData();

  test('Area is among DyckPath’s statistics, and nothing is listed by hand', () => {
    expect(names.carriers.DyckPath?.statistics).toContain('Area');
    expect(names.carriers.DyckPath?.statistics.length).toBeGreaterThan(5);
  });

  test('Inverse is among Permutation’s maps', () => {
    expect(names.carriers.Permutation?.maps).toContain('Inverse');
  });

  test('a FindStat identifier maps to the name', () => {
    expect(names.identifiers.St000012).toBe('Area');
  });

  test('Permutation has more than fifty statistics', () => {
    expect(names.carriers.Permutation?.statistics.length).toBeGreaterThan(50);
  });

  test('every carrier a live row constructs with is a carrier of notatio', () => {
    for (const row of rows.filter((r) => r.status === 'live')) {
      const head = elementHeadOf(row, parseCell);
      if (head === undefined) continue;
      expect(names.carriers[head], `${row.name}: ${head}`).toBeDefined();
    }
  });
});
