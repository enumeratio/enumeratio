import { beforeAll, describe, expect, test } from 'vite-plus/test';
import {
  type RawAnswer,
  answerOf,
  oneLine,
  headOf,
  operandsOf,
  plain,
  sameJson,
} from '../src/index.ts';
import { createNodeKernel } from '../src/node.ts';

describe('plain: MathJSON without its bookkeeping', () => {
  test('numbers, symbols and strings', () => {
    expect(plain({ num: '12' })).toBe(12);
    expect(plain({ sym: 'x' })).toBe('x');
    expect(plain({ str: 'Area' })).toBe(`'Area'`);
    expect(plain(7)).toBe(7);
    expect(plain('x')).toBe('x');
  });

  test('an integer too large for a double stays a { num }', () => {
    const big = '123456789012345678901234567890';
    expect(plain({ num: big })).toEqual({ num: big });
  });

  test('offsets are dropped and lists are read through', () => {
    expect(plain({ fn: ['Area', { num: '3' }], sourceOffsets: [0, 4] })).toEqual(['Area', 3]);
    expect(plain(['List', { num: '1' }, ['List', { sym: 'a' }]])).toEqual([
      'List',
      1,
      ['List', 'a'],
    ]);
  });
});

describe('sameJson', () => {
  test('equal and unequal values', () => {
    expect(sameJson(1, 1)).toBe(true);
    expect(sameJson(1, 2)).toBe(false);
    expect(sameJson(['List', 1, 2], ['List', 1, 2])).toBe(true);
    expect(sameJson(['List', 1, 2], ['List', 1])).toBe(false);
    expect(sameJson(['List', 1, 2], ['List', 2, 1])).toBe(false);
    expect(sameJson({ num: '5' }, { num: '5' })).toBe(true);
    expect(sameJson({ num: '5' }, { num: '6' })).toBe(false);
    expect(sameJson(['List'], { num: '5' })).toBe(false);
    expect(sameJson(null, null)).toBe(true);
    expect(sameJson(null, {})).toBe(false);
  });
});

describe('headOf and operandsOf', () => {
  test('read a call', () => {
    expect(headOf(['Area', 1])).toBe('Area');
    expect(headOf(5)).toBeUndefined();
    expect(headOf([1, 2])).toBeUndefined();
    expect(operandsOf(['Area', 1, 2])).toEqual([1, 2]);
    expect(operandsOf(5)).toEqual([]);
  });
});

describe('answerOf', () => {
  const asked = 'Factorization(360)';
  const call = ['Factorization', 360];

  test('an answer equal to its parsed input was left unevaluated: declined', () => {
    const answer = answerOf(asked, { value: call, input: call });
    expect(answer.status).toBe('declined');
    expect(answer.reason).toBeTruthy();
    expect(answer.asked).toBe(asked);
  });

  test('the input is compared without its offsets and with numbers as { num }', () => {
    const input = { fn: ['Factorization', { num: '360' }], sourceOffsets: [0, 18] };
    expect(answerOf(asked, { value: call, input }).status).toBe('declined');
  });

  test('the same answer is a value when the expression is expected to stand as written', () => {
    expect(answerOf(asked, { value: call, input: call }, true).status).toBe('value');
  });

  test('an answer that differs from its input is a value', () => {
    const answer = answerOf('FactorInteger(360)', {
      value: ['List', ['Tuple', 2, 3]],
      input: ['FactorInteger', 360],
    });
    expect(answer.status).toBe('value');
    expect(answer.json).toEqual(['List', ['Tuple', 2, 3]]);
  });

  test('a number or a symbol is never a decline for being like its input', () => {
    expect(answerOf('2', { value: 2, input: 2 }).status).toBe('value');
    expect(answerOf('True', { value: 'True', input: 'True' }).status).toBe('value');
  });

  test('the epsil of the answer is kept when the kernel writes one', () => {
    const answer = answerOf('1+1', {
      value: 2,
      input: ['Add', 1, 1],
      boxes: { text: { inputform: '2' } },
    });
    expect(answer.epsil).toBe('2');
    expect(answer.input).toEqual(['Add', 1, 1]);
  });

  test.each([
    ['the symbol Missing', 'Missing'],
    ['a Missing call', ['Missing', 'NotFound']],
    ['NaN', 'NaN'],
    ['Nothing', 'Nothing'],
    ['Undefined', 'Undefined'],
    ['Aborted', 'Aborted'],
  ] as [string, unknown][])('%s is declined, not a value', (_name, value) => {
    expect(answerOf(asked, { value }).status).toBe('declined');
  });

  test('no value at all is declined: the kernel ran out of time', () => {
    const answer = answerOf(asked, {});
    expect(answer.status).toBe('declined');
    expect(answer.reason).toMatch(/time/);
  });

  test('an error is an error', () => {
    const answer = answerOf(asked, { error: 'syntax error at 3' });
    expect(answer.status).toBe('error');
    expect(answer.reason).toBe('syntax error at 3');
  });

  test('an Error inside the value is an error', () => {
    expect(answerOf(asked, { value: ['List', ['Error', 'oops']] }).status).toBe('error');
  });

  test('a message with the code argtype is a decline, and carries its text', () => {
    const raw: RawAnswer = {
      value: ['At', 3, 2],
      input: ['At', 3, 2, 'extra'],
      messages: [{ code: 'argtype', text: 'At: argument 1 must be a list' }],
    };
    const answer = answerOf('At(3, 2)', raw);
    expect(answer.status).toBe('declined');
    expect(answer.reason).toBe('At: argument 1 must be a list');
  });

  test('a message of another code does not decline', () => {
    const raw: RawAnswer = {
      value: ['Foo', 1],
      input: ['Bar', 1],
      messages: [{ code: 'note', text: 'unrelated' }],
    };
    expect(answerOf('Bar(1)', raw).status).toBe('value');
  });

  test('a refusal message does not decline an expression expected to stand', () => {
    const raw: RawAnswer = {
      value: ['Foo', 1],
      input: ['Bar', 1],
      messages: [{ code: 'argtype', text: 'refused' }],
    };
    expect(answerOf('Bar(1)', raw, true).status).toBe('value');
  });
});

describe('the kernel in Node', () => {
  // One kernel for the file; its first request loads the libraries.
  const ask = createNodeKernel();
  beforeAll(async () => {
    await ask('1');
    await ask('Count(DyckPaths(2))');
    await ask('FactorInteger(6)');
  });

  test('Factorization(360) is a value: the bases and the exponents', async () => {
    const answer = await ask('Factorization(360)');
    expect(answer.status).toBe('value');
    expect(answer.json).toEqual(['Factorization', ['Tuple', ['List', 2, 3, 5], ['List', 3, 2, 1]]]);
  });

  test('FactorInteger(360) is a value', async () => {
    const answer = await ask('FactorInteger(360)');
    expect(answer.status).toBe('value');
    expect(answer.json).toEqual(['List', ['Tuple', 2, 3], ['Tuple', 3, 2], ['Tuple', 5, 1]]);
    expect(answer.epsil).toBe('[(2, 3), (3, 2), (5, 1)]');
  });

  test('a syntax error is an error', async () => {
    const answer = await ask('Area(');
    expect(answer.status).toBe('error');
    expect(answer.reason).toBeTruthy();
  });

  test('a constructor stands as written when it is expected to', async () => {
    const answer = await ask('Permutation([2, 1, 4, 3])', { holds: true });
    expect(answer.status).toBe('value');
    expect(answer.json).toEqual(['Permutation', ['List', 2, 1, 4, 3]]);
    // Without that, the same expression, returned as it was asked, is a decline.
    expect((await ask('Permutation([2, 1, 4, 3])')).status).toBe('declined');
  });

  test('Count(DyckPaths(4)) is 14', async () => {
    const answer = await ask('Count(DyckPaths(4))');
    expect(answer.status).toBe('value');
    expect(answer.json).toBe(14);
  });
});

describe('a list prints as [1, 2, 3] through one formatter', () => {
  test('a list the kernel broke over lines, with its trailing comma', () => {
    expect(oneLine('[\n  1,\n  2,\n  360,\n]')).toBe('[1, 2, 360]');
    expect(oneLine('[\n  (2, 3),\n  (5, 1),\n]')).toBe('[(2, 3), (5, 1)]');
  });
  test('a nested list, and a line that is already one line', () => {
    expect(oneLine('[\n  [\n    1,\n  ],\n  [\n    2,\n  ],\n]')).toBe('[[1], [2]]');
    expect(oneLine('[1, 2, 3]')).toBe('[1, 2, 3]');
  });
  test('an answer carries its epsil on one line', () => {
    const answer = answerOf('Divisors(6)', {
      value: ['List', 1, 2, 3, 6],
      boxes: { text: { inputform: '[\n  1,\n  2,\n  3,\n  6,\n]' } },
    } as RawAnswer);
    expect(answer.epsil).toBe('[1, 2, 3, 6]');
  });
});
