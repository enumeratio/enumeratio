import { describe, expect, test } from 'vite-plus/test';
import { dotSegments, marks } from '@enumeratio/address';
import { type Codec, type Items, codecs, itemsFromJson, itemsToEpsil } from '../src/index.ts';

// Expected strings are built from the table of marks; the only literals are the spellings
// that site map §5 itself quotes.
const ordered = (...items: (string | number)[]): string => items.join(marks.ordered);
const unordered = (...items: (string | number)[]): string => items.join(marks.unordered);
const blocks = (...items: (string | number)[]): string => items.join(marks.block);
const negative = (n: number): string => marks.negative + n;

const shapes = Object.keys(codecs) as (keyof typeof codecs)[];

describe('every shape writes what it reads', () => {
  const canonical: Record<keyof typeof codecs, string[]> = {
    integer: ['0', '5040', negative(3), '123456789012345678901234567890'],
    ordered: [ordered(2, 1, 4, 3), ordered(1), ordered(10, 2, 11), ordered(1, negative(3), 2)],
    parts: [ordered(4, 2, 1), ordered(4), ordered(10, 1), '421'],
    digits: ['11010010', '10', '0'],
    unordered: [unordered(1, 3), unordered(1), unordered(2, 10), unordered(negative(2), 1)],
    blocks: [
      blocks(unordered(1, 3), 2, 4),
      unordered(1, 2, 3),
      blocks(unordered(1, 10), unordered(2, 3)),
    ],
  };

  test.each(shapes)('%s: write(read(s)) is s for a canonical string', (shape) => {
    const codec: Codec = codecs[shape];
    for (const s of canonical[shape]) {
      const items = codec.read(s);
      expect(items, `${shape} reads ${s}`).not.toBeNull();
      expect(codec.write(items as Items), `${shape} writes ${s}`).toBe(s);
    }
  });

  test('every shape has a codec and no other', () => {
    expect(shapes.toSorted()).toEqual(
      ['blocks', 'digits', 'integer', 'ordered', 'parts', 'unordered'].toSorted(),
    );
  });

  test('integers have one spelling: no leading zeros, no negative zero', () => {
    expect(codecs.integer.read('007')).toBe('7');
    expect(codecs.integer.read(negative(0))).toBe('0');
    expect(codecs.integer.write('7')).toBe('7');
  });
});

describe('other spellings read to the canonical one', () => {
  // These four quote the site map's §5 table, so they are literal.
  const spellings = [`2'1'4'3`, '2,1,4,3', '[2,1,4,3]', '2143'];

  test.each(spellings)('ordered reads %s as the ordered form', (spelled) => {
    const items = codecs.ordered.read(spelled);
    expect(items).toEqual(['2', '1', '4', '3']);
    expect(codecs.ordered.write(items as Items)).toBe(ordered(2, 1, 4, 3));
  });

  test('Epsil is read too', () => {
    const items: Items = ['2', '1', '4', '3'];
    expect(codecs.ordered.read(itemsToEpsil(items))).toEqual(items);
    const parted: Items = [['1', '3'], ['2'], ['4']];
    expect(codecs.blocks.read(itemsToEpsil(parted))).toEqual(parted);
    expect(codecs.blocks.write(parted)).toBe(blocks(unordered(1, 3), 2, 4));
  });

  test('spaces are ignored', () => {
    expect(codecs.ordered.read(` 2${marks.ordered} 1 `)).toEqual(['2', '1']);
  });
});

describe('the short form is read only where it cannot be mistaken', () => {
  test('an integer partition: 421 is one part, never three', () => {
    expect(codecs.parts.read('421')).toEqual(['421']);
    expect(codecs.parts.write(['421'])).toBe('421');
    expect(codecs.parts.read(ordered(4, 2, 1))).toEqual(['4', '2', '1']);
    // The same run of digits is three items where the shape allows the short form.
    expect(codecs.ordered.read('421')).toEqual(['4', '2', '1']);
  });

  test('a subset and a set partition: a run of digits is one member', () => {
    expect(codecs.unordered.read('13')).toEqual(['13']);
    expect(codecs.blocks.read('13')).toEqual([['13']]);
  });

  test('a word over digits is the short form, and the separated form is read', () => {
    expect(codecs.digits.read('1101')).toEqual(['1', '1', '0', '1']);
    expect(codecs.digits.read(ordered(1, 1, 0, 1))).toEqual(['1', '1', '0', '1']);
  });
});

describe('what is refused', () => {
  test.each(shapes)('%s: letters', (shape) => {
    expect(codecs[shape].read('abc')).toBeNull();
    expect(codecs[shape].read(ordered('a', 'b'))).toBeNull();
    expect(codecs[shape].read(`1${marks.ordered}x`)).toBeNull();
  });

  test('an unclosed bracket', () => {
    // §5's bracketed spelling, opened and not closed.
    expect(codecs.ordered.read('[2,1,4,3')).toBeNull();
    expect(codecs.parts.read('[2,1')).toBeNull();
    expect(codecs.unordered.read('[1,3')).toBeNull();
    expect(codecs.blocks.read(`[[1,3],[2]`)).toBeNull();
    expect(codecs.blocks.read('[[1,3],[2')).toBeNull();
  });

  test('an empty block', () => {
    expect(codecs.blocks.read(blocks(unordered(1, 3), '', 4))).toBeNull();
    expect(codecs.blocks.read(blocks(unordered(1, 3), ''))).toBeNull();
    expect(codecs.blocks.read(blocks('', unordered(1, 3)))).toBeNull();
    expect(codecs.blocks.read('')).toBeNull();
  });

  test('a non-digit item for digits', () => {
    expect(codecs.digits.read(ordered(1, 12))).toBeNull();
    expect(codecs.digits.write(['1', '12'])).toBeNull();
    expect(codecs.digits.read('1a0')).toBeNull();
  });

  test('an empty value has no spelling', () => {
    for (const shape of shapes) {
      expect(codecs[shape].write([]), shape).toBeNull();
      expect(codecs[shape].write(''), shape).toBeNull();
    }
    expect(codecs.integer.read('')).toBeNull();
    for (const shape of shapes) {
      const items = codecs[shape].read('');
      if (items !== null) expect(codecs[shape].write(items), shape).toBeNull();
    }
  });

  test('a value of the wrong kind has no spelling', () => {
    expect(codecs.integer.write(['1', '2'])).toBeNull();
    expect(codecs.ordered.write('12')).toBeNull();
    expect(codecs.ordered.write([['1'], ['2']])).toBeNull();
    expect(codecs.blocks.write(['1', '2'])).toBeNull();
    expect(codecs.blocks.write([['1'], []])).toBeNull();
  });

  test.each(shapes)('%s: a notation the codec does not know is refused', (shape) => {
    expect(codecs[shape].read('1', 'cycle')).toBeNull();
    expect(codecs[shape].read(ordered(2, 1), 'nosuchnotation')).toBeNull();
  });
});

describe('order is normalized where it carries no meaning', () => {
  test('unordered: members ascending, numerically', () => {
    expect(codecs.unordered.read(unordered(3, 1))).toEqual(['1', '3']);
    expect(codecs.unordered.read(unordered(10, 2))).toEqual(['2', '10']);
    expect(codecs.unordered.write(['3', '1'])).toBe(unordered(1, 3));
    expect(codecs.unordered.write(['10', '2'])).toBe(unordered(2, 10));
  });

  test('blocks: members ascending, blocks by least member', () => {
    const spelled = blocks(unordered(4), unordered(2), unordered(3, 1));
    expect(codecs.blocks.read(spelled)).toEqual([['1', '3'], ['2'], ['4']]);
    expect(codecs.blocks.write([['4'], ['2'], ['3', '1']])).toBe(blocks(unordered(1, 3), 2, 4));
    expect(codecs.blocks.write([['10', '2'], ['1']])).toBe(blocks(1, unordered(2, 10)));
  });

  test('ordered: order is kept', () => {
    expect(codecs.ordered.read(ordered(2, 1, 4, 3))).toEqual(['2', '1', '4', '3']);
    expect(codecs.parts.read(ordered(1, 4))).toEqual(['1', '4']);
  });
});

describe('what a codec writes is a safe value', () => {
  const unsafe = [
    'x',
    `1${marks.notation}2`,
    `${marks.rank}7`,
    `${marks.notation}`,
    ...dotSegments,
    '',
    `${marks.rank}`,
  ];

  const violates = (text: string): boolean =>
    text === '' ||
    text.includes(marks.notation) ||
    text.startsWith(marks.rank) ||
    dotSegments.includes(text);

  test.each(shapes)(
    '%s: nothing it writes contains the notation mark, starts with the rank sigil, or is a dot segment',
    (shape) => {
      const codec: Codec = codecs[shape];
      const candidates: Items[] = [
        ...unsafe,
        ...unsafe.map((u) => [u]),
        ...unsafe.map((u) => [[u]]),
        ['1', '2'],
        [['1', '2'], ['3']],
      ];
      for (const items of candidates) {
        const written = codec.write(items);
        if (written !== null) expect(violates(written), `${shape} wrote ${written}`).toBe(false);
      }
      // And from what a reader may type.
      const typed = [
        ...unsafe,
        `${marks.rank}7`,
        `${marks.notation}${marks.notation}`,
        `1${marks.notation}`,
        ordered(1, 2),
      ];
      for (const raw of typed) {
        const read = codec.read(raw);
        const written = read === null ? null : codec.write(read);
        if (written !== null)
          expect(violates(written), `${shape}: ${raw} wrote ${written}`).toBe(false);
      }
    },
  );

  // Suspected bug in packages/codecs/src/index.ts (`compare`, line 56, reached from the
  // unordered and blocks writers at lines 173 and 180): a list of two or more items of which
  // one is not an integer throws a SyntaxError from BigInt instead of writing null.
  test('unordered refuses a non-integer item with null, not a throw', () => {
    expect(codecs.unordered.write(['1', 'x'])).toBeNull();
  });
  test('blocks refuses a non-integer item with null, not a throw', () => {
    expect(codecs.blocks.write([['1', 'x']])).toBeNull();
  });

  test('a dot segment and a rank-like value are refused outright', () => {
    for (const dot of dotSegments) expect(codecs.integer.write(dot)).toBeNull();
    expect(codecs.integer.write(`${marks.rank}7`)).toBeNull();
    expect(codecs.ordered.write([`${marks.rank}7`])).toBeNull();
    expect(codecs.integer.write(`1${marks.notation}2`)).toBeNull();
  });
});

describe('itemsToEpsil and itemsFromJson', () => {
  /** An item as MathJSON, the way the kernel returns it. */
  const toJson = (items: Items): unknown =>
    typeof items === 'string'
      ? Number.isSafeInteger(Number(items))
        ? Number(items)
        : { num: items }
      : ['List', ...items.map(toJson)];

  const samples: Items[] = [
    '5',
    negative(3),
    '0',
    ['2', '1', '4', '3'],
    [['1', '3'], ['2'], ['4']],
    [],
    [[], ['1']],
    ['1', ['2', '3']],
  ];

  test.each(samples.map((s) => [JSON.stringify(s), s] as const))(
    'items %s survive MathJSON and Epsil',
    (_name, items) => {
      expect(itemsFromJson(toJson(items))).toEqual(items);
      expect(itemsToEpsil(items)).toBe(
        typeof items === 'string' ? items : `[${items.map(itemsToEpsil).join(', ')}]`,
      );
    },
  );

  test('an integer too large for a double is given as a { num } and is kept whole', () => {
    const big = '123456789012345678901234567890';
    expect(itemsFromJson({ num: big })).toBe(big);
    expect(itemsToEpsil(big)).toBe(big);
    expect(itemsFromJson(['List', { num: big }, 2])).toEqual([big, '2']);
    expect(itemsFromJson({ num: negative(7) })).toBe(negative(7));
    expect(itemsFromJson(BigInt(big))).toBe(big);
  });

  test('anything that is not an integer or a list of values is undefined', () => {
    expect(itemsFromJson(1.5)).toBeUndefined();
    expect(itemsFromJson('x')).toBeUndefined();
    expect(itemsFromJson(null)).toBeUndefined();
    expect(itemsFromJson(['Foo', 1])).toBeUndefined();
    expect(itemsFromJson(['List', 1, 'x'])).toBeUndefined();
    expect(itemsFromJson({ num: '1.5' })).toBeUndefined();
    expect(itemsFromJson({ sym: 'x' })).toBeUndefined();
  });

  test('a value written as Epsil is read back by its codec', () => {
    for (const [shape, items] of [
      ['ordered', ['2', '1', '4', '3']],
      ['parts', ['4', '2', '1']],
      ['unordered', ['1', '3']],
      ['blocks', [['1', '3'], ['2'], ['4']]],
    ] as [keyof typeof codecs, Items][]) {
      expect(codecs[shape].read(itemsToEpsil(items)), shape).toEqual(items);
    }
  });
});
