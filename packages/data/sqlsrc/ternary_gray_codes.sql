-- requires: realizer, utilities
-- ternary_gray_codes — for each n, the reflected TERNARY (base-3, Guan) Gray code: all 3^n length-n words over
-- {0,1,2} ordered so consecutive words differ in exactly one digit by ±1 (the mixed-radix generalization of the
-- binary reflected Gray code in gray_codes.sql — #155's base-3 gap). Sibling collection, not a restriction: the
-- carrier/ordering/unrank are all fresh, base-3 analogues of gray_codes.sql's shapes.
--
-- Construction (reflected/Guan code, standard mixed-radix generalization of binary's g = r XOR (r>>1)): write rank
-- r (0..3^n-1) in standard base-3, digits a_{n-1}..a_0 MSB-first. Walk MSB→LSB carrying a `flip` bit (init false):
-- at digit i, g_i = flip ? (2 - a_i) : a_i, then flip ^= (a_i = 1) using the ORIGINAL a_i. Equivalently (closed
-- form, no running state): g_i = a_i complemented iff an ODD number of higher digits a_j (j > i) equal 1 — this
-- is what ternary_gray_unrank computes directly per digit. (For odd bases, digit-complement d ↦ (b-1)-d preserves
-- parity, so it doesn't matter whether the toggle test reads the pre- or post-complement digit; both agree.)
-- Recursively this is: block k (the top digit, k=0,1,2) holds fiber_count(n-1) words with prefix k, traversed
-- forward through the (n-1)-digit code when k is even, reversed when k is odd — the same "reflect" the binary
-- code uses, generalized to 3 digit values per block instead of 2. Verified by hand for n=2 (below) and n=3.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE ternary_gray_code AS (digits int[]);                        -- MSB first, each digit in {0,1,2}
CREATE FUNCTION notation(w ternary_gray_code) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((w).digits, '') $$;

-- rank r (0..3^n-1) ↦ its ternary Gray codeword: for each place i (0=LSB..n-1=MSB), complement digit a_i =
-- (r / 3^i) mod 3 iff an odd number of MORE SIGNIFICANT digits a_j (j>i) equal 1, then emit MSB-first.
CREATE FUNCTION ternary_gray_unrank(n int, r bigint) RETURNS ternary_gray_code LANGUAGE sql IMMUTABLE AS $$
  WITH digit AS (
    SELECT i, ((r / pow_int(3, i)::bigint)::bigint % 3)::int AS a FROM generate_series(0, n - 1) i
  )
  SELECT ROW(ARRAY(
    SELECT CASE WHEN (SELECT count(*) FROM digit hi WHERE hi.i > d.i AND hi.a = 1) % 2 = 1
                THEN 2 - d.a ELSE d.a END
      FROM digit d ORDER BY d.i DESC
  ))::ternary_gray_code $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE ternary_gray_codes_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: emit in order of r — that IS Gray order (consecutive r's differ by one digit by ±1), so ordinality = r.
CREATE FUNCTION fiber_elements(f ternary_gray_codes_fiber, element_limit int) RETURNS SETOF ternary_gray_code LANGUAGE sql STABLE AS $$
  SELECT ternary_gray_unrank((f).n::int, r) FROM generate_series(0, pow_int(3, (f).n::int)::bigint - 1) r ORDER BY r LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f ternary_gray_codes_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT pow_int(3, (f).n::int) $$;

-- the reflected ternary Gray code of length n is a permutation of ALL n-digit ternary words, so membership is
-- exactly the shape check: length n, every digit in {0,1,2} — no relation to any specific r needs checking.
CREATE FUNCTION contains_in_fiber(f ternary_gray_codes_fiber, v ternary_gray_code) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).digits, 1), 0) = (f).n::int
     AND coalesce((SELECT bool_and(d IN (0, 1, 2)) FROM unnest((v).digits) d), true) $$;

-- declare it as DATA + realize
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f ternary_gray_codes_fiber, rank rank_index) RETURNS ternary_gray_code LANGUAGE sql IMMUTABLE AS $fu$ SELECT ternary_gray_unrank((f).n::int, rank) $fu$;
INSERT INTO base_collection VALUES ('ternary_gray_codes', 'ternary_gray_code');
INSERT INTO base_grade VALUES ('ternary_gray_codes', 1, 'n', NULL, NULL);
SELECT base_realize('ternary_gray_codes');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ternary_gray_codes','cardinality anchor 3^n for n=0..4 (accel)','eq','1,3,9,27,81','pow_int(3,n)',$q$
    SELECT string_agg(cardinality(ternary_gray_codes(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('ternary_gray_codes','n=1 in reflected ternary Gray order','eq','0,1,2','r=0,1,2 -> g=0,1,2 (single digit, no flips possible)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ternary_gray_codes(1)) e $q$),
  ('ternary_gray_codes','n=2 in reflected ternary Gray order','eq','00,01,02,12,11,10,20,21,22','the 9 two-digit words; hand-verified reflect-and-shift blocks',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ternary_gray_codes(2)) e $q$),
  ('ternary_gray_codes','n=0 => one empty word','eq','1|','3^0=1, the empty digit vector',$q$
    SELECT cardinality(ternary_gray_codes(0))::text || '|' || notation((unrank(ternary_gray_codes(0), 0)).value) $q$),
  ('ternary_gray_codes','floor generates 81 words at n=4 (cardinality via counting)','eq','81','independent of the 3^n accel',$q$
    SELECT count(*)::text FROM elements(ternary_gray_codes(4)) e $q$),
  ('ternary_gray_codes','defining invariant: consecutive codewords differ in exactly one digit, by ±1 (n=2, all 9)','eq','true','adjacent ordinalities',$q$
    SELECT bool_and(
        (SELECT count(*) FROM generate_series(1, array_length(cur.digits, 1)) j WHERE cur.digits[j] <> prev.digits[j]) = 1
        AND (SELECT abs(cur.digits[j] - prev.digits[j]) FROM generate_series(1, array_length(cur.digits, 1)) j
              WHERE cur.digits[j] <> prev.digits[j]) = 1
      )::text
    FROM (SELECT ordinality(e) ord, ((e).value).digits digits FROM elements(ternary_gray_codes(2)) e) cur
    JOIN (SELECT ordinality(e) ord, ((e).value).digits digits FROM elements(ternary_gray_codes(2)) e) prev
      ON prev.ord = cur.ord - 1 $q$),
  ('ternary_gray_codes','defining invariant holds at n=3 too (26 adjacent pairs across all 27 words)','eq','true','same adjacency check, one grade up',$q$
    SELECT bool_and(
        (SELECT count(*) FROM generate_series(1, array_length(cur.digits, 1)) j WHERE cur.digits[j] <> prev.digits[j]) = 1
        AND (SELECT abs(cur.digits[j] - prev.digits[j]) FROM generate_series(1, array_length(cur.digits, 1)) j
              WHERE cur.digits[j] <> prev.digits[j]) = 1
      )::text
    FROM (SELECT ordinality(e) ord, ((e).value).digits digits FROM elements(ternary_gray_codes(3)) e) cur
    JOIN (SELECT ordinality(e) ord, ((e).value).digits digits FROM elements(ternary_gray_codes(3)) e) prev
      ON prev.ord = cur.ord - 1 $q$),
  ('ternary_gray_codes','element carries a TYPED point fiber + ordinality','eq','3|5','unrank(ternary_gray_codes(3),5)',$q$
    SELECT (unrank(ternary_gray_codes(3), 5)).fiber.n::text || '|' || ordinality(unrank(ternary_gray_codes(3), 5))::text $q$),
  ('ternary_gray_codes','unrank(ternary_gray_codes(2), 5) = 10','eq','10','position 5 (0-indexed) of 00,01,02,12,11,10,...',$q$
    SELECT notation((unrank(ternary_gray_codes(2), 5)).value) $q$),
  ('ternary_gray_codes','range handle: cardinality(ternary_gray_codes(0,3)) = 40 = 1+3+9+27','eq','40','3^0+3^1+3^2+3^3 summed over fibers',$q$
    SELECT cardinality(ternary_gray_codes(0,3))::text $q$),
  ('ternary_gray_codes','fibers(ternary_gray_codes(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(ternary_gray_codes(0,3)) f $q$),
  ('ternary_gray_codes','contains: any 3-digit ternary word is in ternary_gray_codes(3) (it''s a permutation of all of them)','eq','true|false|false','via <@',$q$
    SELECT (ROW(ARRAY[2,1,0])::ternary_gray_code <@ ternary_gray_codes(3))::text || '|' ||
           (ROW(ARRAY[1,1])::ternary_gray_code <@ ternary_gray_codes(3))::text || '|' ||
           (ROW(ARRAY[1,3,0])::ternary_gray_code <@ ternary_gray_codes(3))::text $q$);
