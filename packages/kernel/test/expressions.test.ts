import { describe, expect, test } from 'vite-plus/test';
import { type RouteRow, columns, parseRouteFile, rowByName, rows } from '@enumeratio/routes';
import { rankVariable, valueVariable } from '@enumeratio/routes/parse';
import {
  type Cell,
  cellTexts,
  fill,
  headsOfRow,
  isAtomic,
  substituteJson,
  symbolsIn,
} from '../src/cell.ts';
import {
  collectionExpression,
  elementExpression,
  headsIn,
  identityParameters,
  kthExpression,
  measuredBindings,
  parametersIn,
  readCell,
  readElementJson,
} from '../src/expressions.ts';
import type { Json } from '../src/index.ts';
import { cellTable, parseCell } from '../src/parse-cells.ts';

/** MathJSON's head for a list. */
const listHead = 'List';

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

const allCells = rows.flatMap((row) => cellTexts(row).map((text) => ({ row, text })));

describe('the route file’s expressions are Epsil, read by notatio’s parser at build', () => {
  test('every expression cell of every row parses, in Node, against the parser directly', () => {
    expect(allCells.length).toBeGreaterThan(0);
    for (const { row, text } of allCells) {
      expect(() => parseCell(text), `${row.name}: ${text}`).not.toThrow();
    }
  });

  test('the table the pages read is what the parser makes of the cells', () => {
    const table = cellTable(rows);
    for (const { row, text } of allCells) {
      expect(readCell(text), `${row.name}: ${text}`).toEqual(table[text]);
      expect(readCell(text), `${row.name}: ${text}`).toEqual(parseCell(text));
    }
  });

  test('a cell that is not in the route file is an error, not a guess', () => {
    expect(() => readCell('NotACell(')).toThrow(/not a cell/);
  });

  test('Epsil’s own syntax is read: an infix operator is the call it stands for', () => {
    expect(parseCell('k - 1').json).toEqual(['Subtract', 'k', 1]);
    expect(parseCell('Subtract(k, 1)').json).toEqual(['Subtract', 'k', 1]);
    expect(parseCell('[a, 12]').json).toEqual([listHead, 'a', 12]);
  });

  test.each(['Foo(', 'Foo(a))', '[a', '(a'])('the text “%s” is an error, not a guess', (text) => {
    expect(() => parseCell(text)).toThrow(/cannot read/);
  });

  test('each symbol’s place in the text is where the parser found it', () => {
    for (const { row, text } of allCells) {
      const cell = readCell(text);
      for (const [start, end, name] of cell.slots) {
        expect(text.slice(start, end), `${row.name}: ${text}`).toBe(name);
      }
      // Every variable of the expression has a place.
      expect(new Set(cell.slots.map((s) => s[2])), `${row.name}: ${text}`).toEqual(
        symbolsIn(cell.json),
      );
    }
  });

  test('filling the text with values is the same as substituting them in the parsed expression', () => {
    const values = new Map([
      ['k', '12'],
      ['x', '[3, 1, 2]'],
      ['n', '5'],
      ['size', '4'],
      ['blocks', '2'],
      ['parts', '3'],
      ['semilength', '4'],
    ]);
    for (const { row, text } of allCells) {
      const cell: Cell = readCell(text);
      const filled = fill(text, cell, values);
      const asJson = substituteJson(
        cell.json,
        new Map([...values].map(([name, value]) => [name, parseCell(value).json] as const)),
      );
      expect(parseCell(filled).json, `${row.name}: ${text} -> ${filled}`).toEqual(asJson);
    }
  });

  test('every head a live row names is read at build, and the rows’ heads agree with the parser', () => {
    for (const row of rows.filter((r) => r.status === 'live')) {
      expect(headsIn(row).toSorted(), row.name).toEqual(headsOfRow(row, parseCell).toSorted());
    }
  });

  test('every stub or live row has an expression, an element, a value shape and declared parameters', () => {
    for (const row of rows.filter((r) => r.status === 'stub' || r.status === 'live')) {
      const words = (row.parameters ?? []).map((p) => p.word);
      // Every parameter is named in at least one form of the expression.
      const named = new Set(row.expressions.flatMap((form) => parametersIn(row, form)));
      for (const word of words) {
        expect(named.has(word), `${row.name}: no form of the expression uses ${word}`).toBe(true);
      }
      // Every symbol a form uses, other than a bare symbol standing alone, is a parameter.
      for (const form of row.expressions) {
        const { json } = readCell(form);
        if (typeof json === 'string') continue;
        for (const name of symbolsIn(json)) {
          expect(words, `${row.name}: ${name} in the expression is not a parameter`).toContain(
            name,
          );
        }
      }
      // The element is written over x and parameters only; a measure over x and nothing else.
      for (const name of symbolsIn(readCell(row.element as string).json)) {
        const ok = name === valueVariable || words.includes(name);
        expect(ok, `${row.name}: ${name} in the element`).toBe(true);
      }
      for (const [word, measure] of row.measures) {
        expect(words, `${row.name}: a measure of ${word}`).toContain(word);
        for (const name of symbolsIn(readCell(measure).json))
          expect(name, `${row.name}: measure ${word}`).toBe(valueVariable);
      }
    }
  });

  test('a row’s k-th member is over k alone, and uses it', () => {
    for (const row of rows.filter((r) => r.kth !== undefined)) {
      const { json } = readCell(row.kth as string);
      const stray = [...symbolsIn(json)].filter((n) => n !== rankVariable && !/^[A-Z]/.test(n));
      expect(stray, row.name).toEqual([]);
      expect(symbolsIn(json).has(rankVariable), row.name).toBe(true);
    }
  });

  test('a row’s k-th member is written for a rank', () => {
    const [row] = parseRouteFile(
      `${columns.join('\t')}\n${columns
        .map(
          (c) =>
            ({ name: 'X', kind: 'collection', status: 'live', kth: 'k - 1' })[c as string] ?? '',
        )
        .join('\t')}`,
    ).rows;
    expect(row?.kth).toBe('k - 1');
    expect(row && kthExpression(row, 7)).toBe('7 - 1');
    expect(headsIn(row as RouteRow)).toEqual(['Subtract']);
    const [none] = parseRouteFile(
      `${columns.join('\t')}\n${columns
        .map((c) => ({ name: 'X', kind: 'collection', status: 'live' })[c as string] ?? '')
        .join('\t')}`,
    ).rows;
    expect(none && kthExpression(none, 7)).toBeUndefined();
  });

  test('the rows that state a k-th member are Natural and Prime', () => {
    expect(rows.filter((r) => r.kth).map((r) => r.name)).toEqual(['Natural', 'Prime']);
    expect(rowOf('Natural').kth).toBe('k - 1');
    expect(kthExpression(rowOf('Natural'), 7)).toBe('7 - 1');
    expect(kthExpression(rowOf('Prime'), 4)).toBe('NthPrime(4)');
  });

  test('a cell is its own text with the values in place, and a value that is not one operand is bracketed', () => {
    expect(kthExpression(rowOf('Natural'), 1_000_000_000)).toBe('1000000000 - 1');
    expect(kthExpression(rowOf('Natural'), -3)).toBe('(-3) - 1');
    expect(elementExpression(rowOf('Permutation'), [], '[3, 1, 2]')).toEqual({
      ok: true,
      epsil: 'Permutation([3, 1, 2])',
    });
    for (const atomic of ['7', 'x', '[1, 2]', 'Length([1, 2])'])
      expect(isAtomic(atomic), atomic).toBe(true);
    for (const compound of ['-3', '1 + 2', 'f(a) + g(b)', '[1] + [2]', 'a b'])
      expect(isAtomic(compound), compound).toBe(false);
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

  test('heads and parameters are read from a row’s expressions', () => {
    expect(headsIn(rowOf('Subset')).toSorted()).toEqual(
      ['Finset', 'KSubsets', 'Length', 'Subsets', 'Tuple'].toSorted(),
    );
    expect(headsIn(rowOf('Natural')).toSorted()).toEqual(['NonNegativeIntegers', 'Subtract']);
    expect(parametersIn(rowOf('Subset'), 'KSubsets(n, k)')).toEqual([
      word('Subset', 0),
      word('Subset', 1),
    ]);
  });
});
