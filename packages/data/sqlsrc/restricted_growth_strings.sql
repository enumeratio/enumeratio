-- requires: realizer, set_partitions
-- restricted_growth_strings — ported from old-backup 44-restricted_growth_strings.sql (+
-- 56-restricted_growth_strings-engines.sql). A restricted growth string (RGS) of length n is a word
-- w over the non-negative integers with w_1 = 0 and w_i <= 1 + max(w_1, .., w_{i-1}). Read as a code,
-- w_i names the block containing element i, with blocks numbered by order of first appearance — the
-- canonical WORD encoding of a set partition of [n]. There are Bell(n) of them (OEIS A000110).
--
-- The old architecture made restricted_growth_strings the engine OWNER (the suffix-count DP for
-- rgs-lex order + the grade-restricted unrank) and had set_partitions (its STRUCTURE-reading sibling)
-- borrow the engine via an order-isomorphic bijection, because rgs-lex order is fundamentally an order
-- on WORDS. In the new architecture that floor is already realized verbatim on the `set_partition`
-- carrier (see set-partitions.sql) — the RGS *is* that carrier's floor. This file re-realizes the SAME
-- mathematical floor as its own FIRST-CLASS collection, on a fresh `rgs_word` carrier with its own
-- rgs-string notation, so restricted_growth_strings is addressable and countable in its own right
-- rather than only as set_partitions' internal representation. Single grade [n] (size); reuses bell()
-- (from set-partitions.sql) for the closed-form fiber count.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE rgs_word AS (word int[]);                                 -- w_1=0, w_i <= 1+max(w_1..w_{i-1}); {0,1,0}
CREATE FUNCTION notation(w rgs_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((w).word, ''), '') $$;

-- number of distinct letters used = 1 + max(w) (0 for the empty word) — the block count of the
-- partition this word encodes; an instance-method stat on the carrier (St000105 in the old catalog).
CREATE FUNCTION parts_count(w rgs_word) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((w).word) x), -1) + 1 $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every valid RGS of length n in lex order. Grow prefixes: extend an RGS of max m by any value
-- 0..m+1. The empty seed (len 0, max -1) forces w_1=0 (only value 0..0), and yields the single empty
-- word when n=0.
CREATE TYPE restricted_growth_strings_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f restricted_growth_strings_fiber, element_limit int) RETURNS SETOF rgs_word LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS word, -1 AS mx, 0 AS len
    UNION ALL
    SELECT b.word || v, greatest(b.mx, v), b.len + 1
    FROM build b, generate_series(0, b.mx + 1) v
    WHERE b.len < (f).n::int)
  SELECT ROW(word)::rgs_word FROM build WHERE len = (f).n::int ORDER BY word LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f restricted_growth_strings_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT bell((f).n::int) $$;

-- contains: v is a valid RGS of length n iff every letter is in 0 .. 1+max(prefix so far).
CREATE FUNCTION contains_in_fiber(f restricted_growth_strings_fiber, v rgs_word) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a int[] := (v).word; mx int := -1; i int; len int := coalesce(array_length((v).word, 1), 0);
  BEGIN
    IF len <> (f).n::int THEN RETURN false; END IF;                     -- wrong length ⇒ not in this fiber
    FOR i IN 1..len LOOP
      IF a[i] < 0 OR a[i] > mx + 1 THEN RETURN false; END IF;           -- w_i must be in 0 .. 1+max(prefix)
      mx := greatest(mx, a[i]);
    END LOOP;
    RETURN true;
  END $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('restricted_growth_strings', 'rgs_word');
INSERT INTO base_grade VALUES ('restricted_growth_strings', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f restricted_growth_strings_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'RGS(' || (f).n::int || ')' $$;   -- corpus symbol
-- direct unrank: the RGS lex-order unrank (shared with set_partitions, same carrier data).
CREATE FUNCTION fiber_unrank(f restricted_growth_strings_fiber, rank rank_index) RETURNS rgs_word LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(rgs_unrank_word((f).n::int, rank::bigint))::rgs_word $fu$;
SELECT base_realize('restricted_growth_strings');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('restricted_growth_strings','RGS of length 3 in lex order','eq','000,001,010,011,012','the floor: all valid length-3 RGS, Bell(3)=5',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(restricted_growth_strings(3)) e $q$),
  ('restricted_growth_strings','COUNT anchor: Bell(n) for n=0..5','eq','1,1,2,5,15,52','cardinality per fiber = Bell(n) (accel)',$q$
    SELECT string_agg(cardinality(restricted_growth_strings(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('restricted_growth_strings','cardinality(restricted_growth_strings(4)) = 15 = Bell(4)','eq','15','the closed-form count accel',$q$
    SELECT cardinality(restricted_growth_strings(4))::text $q$),
  ('restricted_growth_strings','floor generates 15 words at n=4 (cardinality via counting)','eq','15','independent of the Bell accel',$q$
    SELECT count(*)::text FROM elements(restricted_growth_strings(4)) e $q$),
  ('restricted_growth_strings','unrank crosses lex: rank 4 of restricted_growth_strings(3) = 012','eq','012','ranks 0..4 = 000,001,010,011,012',$q$
    SELECT notation((unrank(restricted_growth_strings(3), 4)).value) $q$),
  ('restricted_growth_strings','element carries a TYPED point fiber (axis n)','eq','4','unrank(restricted_growth_strings(4),0).fiber.n',$q$
    SELECT (unrank(restricted_growth_strings(4), 0)).fiber.n::text $q$),
  ('restricted_growth_strings','range constructor (2,4): fibers unfold to n = 2,3,4','eq','2,3,4','the (lo,hi) grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(restricted_growth_strings(2,4)) f $q$),
  ('restricted_growth_strings','range handle cardinality = Bell(2)+Bell(3)+Bell(4) = 22','eq','22','summed over fibers',$q$
    SELECT cardinality(restricted_growth_strings(2,4))::text $q$),
  ('restricted_growth_strings','every word of fiber n=4 is a valid RGS (w_1=0, w_i <= 1+max prefix)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(
        ((e).value).word[1] = 0
        AND (SELECT bool_and(((e).value).word[i] <= 1 + coalesce((SELECT max(x) FROM unnest(((e).value).word[1:i-1]) x), -1))
             FROM generate_series(1, array_length(((e).value).word, 1)) i)
      )::text FROM elements(restricted_growth_strings(4)) e $q$),
  ('restricted_growth_strings','parts_count: rank 2 of length 3 (010) uses 2 distinct letters','eq','010|2','parts_count = 1+max(word)',$q$
    SELECT notation((unrank(restricted_growth_strings(3), 2)).value) || '|' ||
           parts_count((unrank(restricted_growth_strings(3), 2)).value)::text $q$),
  ('restricted_growth_strings','contains: valid {0,1,0} ∈, malformed {0,2,1} ∉ restricted_growth_strings(3)','eq','true|false','w_2=2 > 1+max prefix is not an RGS',$q$
    SELECT contains(restricted_growth_strings(3), ROW(ARRAY[0,1,0])::rgs_word)::text || '|' ||
           contains(restricted_growth_strings(3), ROW(ARRAY[0,2,1])::rgs_word)::text $q$),
  ('restricted_growth_strings','the <@ operator: {0,1,2} <@ restricted_growth_strings(3)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[0,1,2])::rgs_word <@ restricted_growth_strings(3))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('restricted_growth_strings','fiber_unrank(restricted_growth_strings(4), 0..14) are all members (accel floor)','eq','true','RGS lex unrank lands inside RGS(4) for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(restricted_growth_strings(4)) f), ord::rank_index) <@ restricted_growth_strings(4))::text
      FROM generate_series(0, cardinality(restricted_growth_strings(4))::int - 1) ord $q$);
