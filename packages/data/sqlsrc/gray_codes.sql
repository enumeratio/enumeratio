-- requires: narcissistic_numbers, realizer, utilities
-- gray_codes — for each n, the reflected binary Gray code: all 2^n n-bit binary words ordered so that
-- consecutive words differ in exactly one bit. Element r (r = 0..2^n-1) has integer value g = r XOR (r >> 1);
-- its bits are the n-bit big-endian expansion of g. Single grade [n]. Provides the floor (emitted in Gray
-- order, i.e. ordinality = r) + a 2^n count accel + a contains engine (same membership as binary_words: the
-- Gray sequence is a permutation of the same 2^n words); base_realize generates handle/fiber/element +
-- constructor (incl. the (lo,hi) range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE gray_code AS (bits int[]);                                  -- MSB first; {1,0,1} = 101
CREATE FUNCTION notation(w gray_code) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((w).bits, '') $$;

-- rank r (0..2^n-1) ↦ its Gray codeword: g = r XOR (r >> 1), then g's n-bit big-endian expansion
CREATE FUNCTION gray_code_unrank(n int, r bigint) RETURNS gray_code LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT (((r # (r >> 1)) >> i) & 1)::int FROM generate_series(n - 1, 0, -1) i))::gray_code $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE gray_codes_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: emit in order of r — that IS Gray order (consecutive r's differ by one bit in g), so ordinality = r.
CREATE FUNCTION fiber_elements(f gray_codes_fiber, element_limit int) RETURNS SETOF gray_code LANGUAGE sql STABLE AS $$
  SELECT gray_code_unrank((f).n::int, r) FROM generate_series(0, (1 << (f).n::int) - 1) r ORDER BY r LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f gray_codes_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT pow_int(2, (f).n::int) $$;

-- the reflected Gray code of length n is a permutation of ALL n-bit binary words, so membership is exactly
-- the shape check: length n, every bit in {0,1} — no relation to any specific r needs checking.
CREATE FUNCTION contains_in_fiber(f gray_codes_fiber, v gray_code) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).bits, 1), 0) = (f).n::int
     AND coalesce((SELECT bool_and(b IN (0, 1)) FROM unnest((v).bits) b), true) $$;

-- declare it as DATA + realize
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f gray_codes_fiber, rank rank_index) RETURNS gray_code LANGUAGE sql IMMUTABLE AS $fu$ SELECT gray_code_unrank((f).n::int, rank) $fu$;
INSERT INTO base_collection VALUES ('gray_codes', 'gray_code');
INSERT INTO base_grade VALUES ('gray_codes', 1, 'n', NULL, NULL);
SELECT base_realize('gray_codes');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gray_codes','cardinality anchor 2^n for n=0..4 (accel)','eq','1,2,4,8,16','pow_int(2,n)',$q$
    SELECT string_agg(cardinality(gray_codes(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('gray_codes','n=2 in reflected Gray order','eq','00,01,11,10','r=0,1,2,3 -> g=0,1,3,2',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(gray_codes(2)) e $q$),
  ('gray_codes','n=0 => one empty word','eq','1|','2^0=1, the empty bit vector',$q$
    SELECT cardinality(gray_codes(0))::text || '|' || notation((unrank(gray_codes(0), 0)).value) $q$),
  ('gray_codes','floor generates 16 words at n=4 (cardinality via counting)','eq','16','independent of the 2^n accel',$q$
    SELECT count(*)::text FROM elements(gray_codes(4)) e $q$),
  ('gray_codes','defining invariant: consecutive codewords differ in exactly one bit','eq','true','n=4, adjacent ordinalities',$q$
    SELECT bool_and(
        (SELECT count(*) FROM generate_series(1, array_length(cur.bits, 1)) j WHERE cur.bits[j] <> prev.bits[j]) = 1
      )::text
    FROM (SELECT ordinality(e) ord, ((e).value).bits bits FROM elements(gray_codes(4)) e) cur
    JOIN (SELECT ordinality(e) ord, ((e).value).bits bits FROM elements(gray_codes(4)) e) prev
      ON prev.ord = cur.ord - 1 $q$),
  ('gray_codes','element carries a TYPED point fiber + ordinality','eq','3|5','unrank(gray_codes(3),5): r=5 -> g=5^2=7=111',$q$
    SELECT (unrank(gray_codes(3), 5)).fiber.n::text || '|' || ordinality(unrank(gray_codes(3), 5))::text $q$),
  ('gray_codes','unrank(gray_codes(3), 5) = 111','eq','111','r=5 -> g = 5 XOR 2 = 7',$q$
    SELECT notation((unrank(gray_codes(3), 5)).value) $q$),
  ('gray_codes','range handle: cardinality(gray_codes(0,3)) = 15 = 1+2+4+8','eq','15','2^0+2^1+2^2+2^3 summed over fibers',$q$
    SELECT cardinality(gray_codes(0,3))::text $q$),
  ('gray_codes','fibers(gray_codes(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(gray_codes(0,3)) f $q$),
  ('gray_codes','contains: any 3-bit word is in gray_codes(3) (it''s a permutation of all of them)','eq','true|false|false','via <@',$q$
    SELECT (ROW(ARRAY[1,1,0])::gray_code <@ gray_codes(3))::text || '|' ||
           (ROW(ARRAY[1,1])::gray_code <@ gray_codes(3))::text || '|' ||
           (ROW(ARRAY[1,2,0])::gray_code <@ gray_codes(3))::text $q$);
