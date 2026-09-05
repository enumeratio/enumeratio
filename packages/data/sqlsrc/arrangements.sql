-- requires: permutations, realizer, utilities
-- arrangements — ported from pg-enumeratio's old-backup 43a-arrangements.sql (+ 56-arrangements-engines.sql).
-- An arrangement of [n] is an injective length-k word drawn from [n] — a partial permutation / k-permutation
-- (sage's Permutations(n,k) = Arrangements([1..n], k)). Multi-grade chain [size (n), length (k)]; length
-- defaults to its full range 0..size, so arrangements(n) unfolds fibers over k and the global order is
-- (n, k, ordinality). Permutations are exactly the length=size fiber.
--
-- Unlike the old carrier, the new `arrangement` composite holds only the word: n is never derivable from the
-- word's contents alone (word {3,1} is a 2-arrangement of [5], [9], or any [n] ⊇ {1,3}), but every engine here
-- receives n via the fiber address — same footing as weak_composition/permutation, whose carriers likewise omit
-- the grade values they're generated under.
--
-- Fiber [n,k] = injective length-k words over 1..n, in LEXICOGRAPHIC order of the word (e.g. [3,2] ⇒
-- 1-2,1-3,2-1,2-3,3-1,3-2). |arrangements(n,k)| = P(n,k) = n!/(n-k)! (falling factorial, A008279); reuses
-- permutations' `factorial`. |arrangements(n)| = Σ_{k=0}^n P(n,k) = A000522(n) (a(n) = n·a(n-1) + 1).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE arrangement AS (word int[]);                              -- injective word; {3,1} = the 2-word 3,1
CREATE FUNCTION notation(a arrangement) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((a).word, '-') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- The collection OWNS its fiber type — a named typed-axis struct whose SIGNATURE is the fibration (size, then
-- length), each a natural_number. Its hooks are the generic overloaded fiber_elements / fiber_count /
-- contains_in_fiber, dispatched on arrangements_fiber. base_realize introspects it → a natural_range handle.
CREATE TYPE arrangements_fiber AS (size natural_number, length natural_number);
-- FLOOR: every injective length-(f).length word over 1..(f).size, built entry-by-entry (each next entry any
-- unused letter), emitted in lex order of the word. k=0 needs no special case: the base row (empty word, len=0)
-- survives the final filter for every n (it's always length 0), giving the single empty word.
CREATE FUNCTION fiber_elements(f arrangements_fiber, element_limit int) RETURNS SETOF arrangement LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
      SELECT ARRAY[]::int[] AS word, 0 AS len
    UNION ALL
      SELECT word || v, len + 1
        FROM build, LATERAL generate_series(1, (f).size::int) v
       WHERE len < (f).length::int AND NOT v = ANY(word)
  )
  SELECT ROW(word)::arrangement FROM build
   WHERE len = (f).length::int
   ORDER BY word
   LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f arrangements_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).length::int < 0 OR (f).length::int > (f).size::int THEN 0::numeric
              ELSE div(factorial((f).size::int), factorial((f).size::int - (f).length::int)) END $$;   -- P(n,k) = n!/(n-k)!

-- contains: v is in fiber [n,k] iff its word has exactly k entries, all distinct, each in [1,n].
CREATE FUNCTION contains_in_fiber(f arrangements_fiber, v arrangement) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).word, 1), 0) = (f).length::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).word) x WHERE x < 1 OR x > (f).size::int)
     AND (SELECT count(DISTINCT x) FROM unnest((v).word) x) = coalesce(array_length((v).word, 1), 0) $$;

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('arrangements', 'arrangement');
INSERT INTO base_grade VALUES
  ('arrangements', 1, 'size', NULL, NULL),
  ('arrangements', 2, 'length', '0', 'g1');                          -- length ranges 0..size by default
CREATE FUNCTION fiber_symbol(f arrangements_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- [n]^(k̲), the falling factorial
  SELECT '[' || (f).size::int || ']^(' || to_combining_underline((f).length) || ')' $$;
-- direct unrank: lex over the injective words. Keep [1..size] available; at position p, the block below each choice
-- is P(size-p, length-p) = (size-p)!/(size-length)! completions, so digit = ⌊x/block⌋ picks the digit-th smallest
-- still-available value (0-based). The classic k-permutation (falling-factorial) unrank.
CREATE FUNCTION arrangement_unrank(sz int, len int, ord bigint) RETURNS arrangement LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE avail int[] := ARRAY(SELECT generate_series(1, sz)); word int[] := '{}'; x numeric := ord; bs numeric; d int; p int; BEGIN
    FOR p IN 1..len LOOP
      bs := factorial(sz - p) / factorial(sz - len);   -- P(sz-p, len-p): completions of the remaining len-p positions
      d := div(x, bs)::int;                             -- 0-based index into the sorted available values
      word := word || avail[d + 1];
      avail := avail[1:d] || avail[d + 2:];             -- drop the chosen value
      x := x - d * bs;
    END LOOP;
    RETURN ROW(word)::arrangement;
  END $$;
CREATE FUNCTION fiber_unrank(f arrangements_fiber, rank rank_index) RETURNS arrangement LANGUAGE sql IMMUTABLE AS $fu$
  SELECT arrangement_unrank((f).size::int, (f).length::int, rank::bigint) $fu$;
SELECT base_realize('arrangements');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('arrangements','anchor |arrangements(4)| = 65 (accel, A000522)','eq','65','1+4+12+24+24 summed over length 0..4',$q$
    SELECT cardinality(arrangements(4))::text $q$),
  ('arrangements','anchor |arrangements(5, length=2)| = 20','eq','20','P(5,2) = 5·4',$q$
    SELECT cardinality(arrangements(5,2))::text $q$),
  ('arrangements','2-arrangements of [3] in lex order','eq','1-2,1-3,2-1,2-3,3-1,3-2','the realized floor for fiber [3,2]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,2)) e $q$),
  ('arrangements','length=0 edge case: the single empty word, for any size','eq','1|1|1','k=0 is always the one empty word',$q$
    SELECT cardinality(arrangements(0,0))::text || '|' || cardinality(arrangements(3,0))::text || '|' || cardinality(arrangements(7,0))::text $q$),
  ('arrangements','fiber counts for n=4 are P(4,k) over k=0..5: 1,4,12,24,24,0','eq','1,4,12,24,24,0','k > n ⇒ 0',$q$
    SELECT string_agg(cardinality(arrangements(4,k))::text, ',' ORDER BY k) FROM generate_series(0,5) k $q$),
  ('arrangements','length RANGE: cardinality(arrangements(4)) sums k=0..4','eq','65','1+4+12+24+24 (accel, matches anchor)',$q$
    SELECT cardinality(arrangements(4))::text $q$),
  ('arrangements','floor count matches the accel at n=4 (independent check)','eq','65','count the floor across all fibers',$q$
    SELECT count(*)::text FROM elements(arrangements(4), 100) e $q$),
  ('arrangements','fibers(arrangements(3)) unfold to length = 0,1,2,3','eq','0,1,2,3','the second grade ranges 0..size',$q$
    SELECT string_agg((f).length::text, ',' ORDER BY (f).length) FROM fibers(arrangements(3)) f $q$),
  ('arrangements','multi-grade chain: fiber = (size,length) named axes','eq','3|2','unrank(arrangements(3,2), 0).fiber is (size=3,length=2)',$q$
    SELECT (unrank(arrangements(3,2), 0)).fiber.size::text || '|' || (unrank(arrangements(3,2), 0)).fiber.length::text $q$),
  ('arrangements','every element of fiber [4,2] is a 2-entry injective word over [1,4]','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).word, 1) = 2
                AND (SELECT count(DISTINCT x) FROM unnest(((e).value).word) x) = 2
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).word) x WHERE x < 1 OR x > 4))::text
      FROM elements(arrangements(4,2)) e $q$),
  ('arrangements','permutations are the length=size fiber: elements(arrangements(3,3)) = the 6 permutations of [3]','eq','1-2-3,1-3-2,2-1-3,2-3-1,3-1-2,3-2-1','length=size fiber',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(arrangements(3,3)) e $q$),
  ('arrangements','contains via <@: 1-3 ∈ (3,2), 1-3 ∉ (3,3) (wrong length), 1-1 ∉ (3,2) (not distinct)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,3])::arrangement <@ arrangements(3,2))::text || '|' ||
           (ROW(ARRAY[1,3])::arrangement <@ arrangements(3,3))::text || '|' ||
           (ROW(ARRAY[1,1])::arrangement <@ arrangements(3,2))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('arrangements','fiber_unrank(arrangements(4,2), 0..11) are all members (accel floor)','eq','true','k-permutation unrank lands inside the P(4,2)=12 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(arrangements(4,2)) f), ord::rank_index) <@ arrangements(4,2))::text
      FROM generate_series(0, cardinality(arrangements(4,2))::int - 1) ord $q$);
