-- requires: realizer, fibonacci
-- sparse_subsets — ported from pg-enumeratio-core_old_backup 43d-sparse_subsets.sql (+ 56-sparse_subsets-engines.sql).
-- A subset of [n] with no two CONSECUTIVE elements — equivalently a length-n binary string with no two adjacent
-- 1s (the independent sets of the path P_n). Single grade [n]. |sparse_subsets(n)| = F(n+2) [[OEIS:A000045]];
-- the old file owned a Zeckendorf ranking to hit that count exactly — here the FLOOR just builds the no-"11"
-- words bit-by-bit and the count accel reuses fibonacci_term(n+2) directly, no ranking scheme required.
-- Canonical order: ascending on the bits array (0 < 1), the same order binary_words uses restricted to the
-- no-"11" words — e.g. n=4: 0000,0001,0010,0100,0101,1000,1001,1010.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE sparse_subset AS (bits int[]);                             -- length-n 0/1 word, no two adjacent 1s
CREATE FUNCTION notation(x sparse_subset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_to_string((x).bits, ''), '') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE sparse_subsets_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: grow the word bit-by-bit (0 always allowed, 1 only after a 0), ascending on the bits array.
CREATE FUNCTION fiber_elements(f sparse_subsets_fiber, element_limit int) RETURNS SETOF sparse_subset LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(bits, last_bit, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.bits || b.bit, b.bit, g.len + 1
      FROM gen g CROSS JOIN (VALUES (0), (1)) AS b(bit)
      WHERE g.len < (f).n::int
        AND (b.bit = 0 OR g.last_bit = 0)                             -- no two adjacent 1s
  )
  SELECT ROW(bits)::sparse_subset FROM gen
  WHERE len = (f).n::int
  ORDER BY bits
  LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f sparse_subsets_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fibonacci_term((f).n::int + 2) $$;                            -- |sparse_subsets(n)| = F(n+2)

CREATE FUNCTION contains_in_fiber(f sparse_subsets_fiber, v sparse_subset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).bits, 1), 0) = (f).n::int                                  -- length n
     AND coalesce((SELECT bool_and(b IN (0, 1)) FROM unnest((v).bits) b), true)               -- every bit 0/1
     AND NOT EXISTS (
       SELECT 1 FROM (SELECT b, lag(b) OVER (ORDER BY o) AS pb
                        FROM unnest((v).bits) WITH ORDINALITY AS t(b, o)) q
        WHERE b = 1 AND pb = 1) $$;                                                           -- no two adjacent 1s

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('sparse_subsets', 'sparse_subset');
INSERT INTO base_grade VALUES ('sparse_subsets', 1, 'n', NULL, NULL);
-- direct unrank: lex over the 0/1 words (0 before 1). #valid completions of `rem` positions after a 0 is F(rem+2)
-- (the block below choosing 0); after a 1 the next bit is forced to 0. Walk position by position.
CREATE FUNCTION sparse_subset_unrank(n int, ord bigint) RETURNS sparse_subset LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE bits int[] := '{}'; x numeric := ord; prev int := 0; i int; blk numeric; bit int; BEGIN
    FOR i IN 1..n LOOP
      IF prev = 1 THEN bit := 0;                                        -- forced: no two adjacent 1s
      ELSE
        blk := fibonacci_term((n - i) + 2);                            -- completions if we place 0 here
        IF x < blk THEN bit := 0; ELSE x := x - blk; bit := 1; END IF;  -- else place 1 (allowed, prev = 0)
      END IF;
      bits := bits || bit; prev := bit;
    END LOOP;
    RETURN ROW(bits)::sparse_subset;
  END $$;
CREATE FUNCTION fiber_unrank(f sparse_subsets_fiber, rank rank_index) RETURNS sparse_subset LANGUAGE sql IMMUTABLE AS $fu$
  SELECT sparse_subset_unrank((f).n::int, rank::bigint) $fu$;
SELECT base_realize('sparse_subsets');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sparse_subsets','|sparse_subsets(n)| = the Fibonacci numbers F(n+2), n=0..6 (accel)','eq','1,2,3,5,8,13,21','fibonacci_term(n+2) [[OEIS:A000045]]',$q$
    SELECT string_agg(cardinality(sparse_subsets(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('sparse_subsets','n=0 ⇒ one empty word','eq','1|','F(2)=1, the empty bit vector',$q$
    SELECT cardinality(sparse_subsets(0))::text || '|' || notation((unrank(sparse_subsets(0), 0)).value) $q$),
  ('sparse_subsets','length 4 in ascending order (no "11")','eq','0000,0001,0010,0100,0101,1000,1001,1010','the realized floor for fiber [4], F(6)=8 words',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(sparse_subsets(4)) e $q$),
  ('sparse_subsets','floor generates 21 words at n=6 (cardinality via counting)','eq','21','independent of the fibonacci accel',$q$
    SELECT count(*)::text FROM elements(sparse_subsets(6)) e $q$),
  ('sparse_subsets','every generated word has length n and no two adjacent 1s','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        array_length(((e).value).bits, 1) = 5
        AND NOT EXISTS (
          SELECT 1 FROM (SELECT b, lag(b) OVER (ORDER BY o) AS pb
                           FROM unnest(((e).value).bits) WITH ORDINALITY AS t(b, o)) q
           WHERE b = 1 AND pb = 1)
      )::text FROM elements(sparse_subsets(5)) e $q$),
  ('sparse_subsets','cardinality(sparse_subsets(6)) = 21 (accel)','eq','21','closed-form Fibonacci',$q$
    SELECT cardinality(sparse_subsets(6))::text $q$),
  ('sparse_subsets','range handle: cardinality(sparse_subsets(0,3)) = 11','eq','11','F(2)+F(3)+F(4)+F(5) = 1+2+3+5',$q$
    SELECT cardinality(sparse_subsets(0,3))::text $q$),
  ('sparse_subsets','fibers(sparse_subsets(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(sparse_subsets(0,3)) f $q$),
  ('sparse_subsets','unrank first/last of length 4','eq','0000|1010','ranks 0 and 7 (F(6)-1)',$q$
    SELECT notation((unrank(sparse_subsets(4), 0)).value) || '|' ||
           notation((unrank(sparse_subsets(4), 7)).value) $q$),
  ('sparse_subsets','element carries a TYPED point fiber + ordinality','eq','4|1','unrank(sparse_subsets(4),1)',$q$
    SELECT (unrank(sparse_subsets(4), 1)).fiber.n::text || '|' || ordinality(unrank(sparse_subsets(4), 1))::text $q$),
  ('sparse_subsets','global order across fibers = (n, ordinality): sparse_subsets(1,2)','eq','0,1,00,01,10','n ascending, lex within',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY e) FROM elements(sparse_subsets(1,2)) e $q$),
  ('sparse_subsets','contains: 0101 ∈ sparse_subsets(4), 0110 ∉ (adjacent 1s), 101 ∉ (wrong length), via <@','eq','true|false|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[0,1,0,1])::sparse_subset <@ sparse_subsets(4))::text || '|' ||
           (ROW(ARRAY[0,1,1,0])::sparse_subset <@ sparse_subsets(4))::text || '|' ||
           (ROW(ARRAY[1,0,1])::sparse_subset <@ sparse_subsets(4))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sparse_subsets','fiber_unrank(sparse_subsets(6), 0..) are all members (accel floor)','eq','true','Fibonacci-constrained unrank lands inside the F(8)=21 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(sparse_subsets(6)) f), ord::rank_index) <@ sparse_subsets(6))::text
      FROM generate_series(0, cardinality(sparse_subsets(6))::int - 1) ord $q$);
