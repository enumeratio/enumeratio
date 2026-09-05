-- requires: realizer, set_compositions
-- surjections — ported from pg-enumeratio-core_old_backup sqlsrc/45-surjections.sql (+ 56-surjections-engines.sql).
-- A surjection word of length n is a word w over {1,...,k} that uses EVERY letter — equivalently a surjection
-- [n] ↠ [k], for some k ≤ n. Read as a code, w_i names the (1-based) block, numbered in COMPOSITION order,
-- containing element i — the canonical word-encoding of an ordered set partition (set_compositions carries the
-- blocks themselves; the two are order-isomorphic, but here we realize the word side as its own carrier).
-- Single grade [n]. cardinality summed over k is the ordered Bell / Fubini number a(n) (OEIS A000670); at
-- exactly k letters it's k!·S(n,k), the surjection triangle (OEIS A019538). Reuses set_compositions' surjective
-- word generator (set_composition_surjections) and its Fubini accel (fubini) — same underlying words, k
-- ascending then lex within k, just a fresh carrier + notation for the word itself (not the block structure).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE surjection AS (values int[]);                             -- word over 1..k, every letter used
CREATE FUNCTION notation(w surjection) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((w).values, ',') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: k ascending (1..n letters used), lex order within each k; n=0 ⇒ the single empty word. Reuses
-- set_compositions' surjective-word generator (identical underlying words to set_composition_surjections).
CREATE TYPE surjections_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f surjections_fiber, element_limit int) RETURNS SETOF surjection LANGUAGE sql STABLE AS $$
  SELECT ROW(w)::surjection FROM (
    SELECT 0 AS k, ARRAY[]::int[] AS w WHERE (f).n::int = 0
    UNION ALL
    SELECT k, w FROM generate_series(1, (f).n::int) k, LATERAL set_composition_surjections((f).n::int, k) AS g(w)
    WHERE (f).n::int > 0
  ) t ORDER BY k, w LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f surjections_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fubini((f).n::int) $$;

-- contains: v is a surjection word of length n iff length n and the distinct values used are exactly {1..k}
-- for some k (contiguous from 1, no gaps, no non-positive values).
CREATE FUNCTION contains_in_fiber(f surjections_fiber, v surjection) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE vals int[] := (v).values; n int := coalesce(array_length(vals,1), 0); distinct_vals int[]; k int;
  BEGIN
    IF n <> (f).n::int THEN RETURN false; END IF;
    IF n = 0 THEN RETURN true; END IF;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO distinct_vals FROM unnest(vals) x;
    k := array_length(distinct_vals, 1);
    RETURN distinct_vals = ARRAY(SELECT generate_series(1, k));           -- exactly {1..k} used, no gaps/negatives
  END $$;

CREATE FUNCTION fiber_symbol(f surjections_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Surj([' || (f).n::int || '])' $$;   -- all surjections out of [n] (Σ_k, Fubini)

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('surjections', 'surjection');
INSERT INTO base_grade VALUES ('surjections', 1, 'n', NULL, NULL);
-- direct unrank: identical words/order to set_compositions — reuse its k-block search + surjective-word unrank.
CREATE FUNCTION fiber_unrank(f surjections_fiber, rank rank_index) RETURNS surjection LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(set_composition_unrank_word((f).n::int, rank::bigint))::surjection $fu$;
SELECT base_realize('surjections');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('surjections','COUNT anchor: Fubini(n) for n=0..5 (accel)','eq','1,1,3,13,75,541','cardinality per fiber',$q$
    SELECT string_agg(cardinality(surjections(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('surjections','cardinality(surjections(3)) = 13','eq','13','the ordered Bell / Fubini accel',$q$
    SELECT cardinality(surjections(3))::text $q$),
  ('surjections','cardinality(surjections(2)) = 3','eq','3','k=1 word {1,1} + k=2 words {1,2},{2,1}',$q$
    SELECT cardinality(surjections(2))::text $q$),
  ('surjections','surjections(0) is the single empty word','eq','1|','count=1, notation=empty',$q$
    SELECT cardinality(surjections(0))::text || '|' || notation((unrank(surjections(0), 0)).value) $q$),
  ('surjections','surjections(2) enumerated: k=1 then k=2 lex','eq','1,1|1,2|2,1','the realized floor, in order',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(surjections(2)) e $q$),
  ('surjections','surjections(3) enumerated in full (13 words)','eq','1,1,1|1,1,2|1,2,1|1,2,2|2,1,1|2,1,2|2,2,1|1,2,3|1,3,2|2,1,3|2,3,1|3,1,2|3,2,1','k=1 (1), k=2 (6), k=3 (6)',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(surjections(3)) e $q$),
  ('surjections','floor generates 13 words at n=3 (cardinality via counting)','eq','13','independent of the Fubini accel',$q$
    SELECT count(*)::text FROM elements(surjections(3)) e $q$),
  ('surjections','every generated word of surjections(3) uses exactly {1..k} for some k, contiguous from 1','eq','true','the defining surjectivity invariant',$q$
    SELECT bool_and(
      (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(((e).value).values) x) =
      ARRAY(SELECT generate_series(1, (SELECT count(DISTINCT x) FROM unnest(((e).value).values) x)::int))
    )::text FROM elements(surjections(3)) e $q$),
  ('surjections','element carries a TYPED point fiber (axis n)','eq','3','unrank(surjections(3),0).fiber.n',$q$
    SELECT (unrank(surjections(3), 0)).fiber.n::text $q$),
  ('surjections','range handle: cardinality(surjections(0,3)) = 1+1+3+13 = 18','eq','18','summed over fibers n=0,1,2,3',$q$
    SELECT cardinality(surjections(0,3))::text $q$),
  ('surjections','fibers(surjections(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(surjections(0,3)) f $q$),
  ('surjections','unrank crosses k inside the fiber: rank 0 of surjections(2) is {1,1} (k=1), rank 1 is first k=2 word','eq','1,1|1,2','',$q$
    SELECT notation((unrank(surjections(2), 0)).value) || '|' || notation((unrank(surjections(2), 1)).value) $q$),
  ('surjections','contains: {1,2,1} ∈ surjections(3); {1,3,1} ∉ (label 2 missing); {1,3} ∉ (wrong length)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(surjections(3), ROW(ARRAY[1,2,1])::surjection)::text || '|' ||
           contains(surjections(3), ROW(ARRAY[1,3,1])::surjection)::text || '|' ||
           contains(surjections(3), ROW(ARRAY[1,3])::surjection)::text $q$),
  ('surjections','the <@ operator: {2,1,2} <@ surjections(3)','eq','true','operator wrapper over contains',$q$
    SELECT (ROW(ARRAY[2,1,2])::surjection <@ surjections(3))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('surjections','fiber_unrank(surjections(4), 0..74) are all members (accel floor)','eq','true','shared word unrank lands inside Fubini(4)=75 for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(surjections(4)) f), ord::rank_index) <@ surjections(4))::text
      FROM generate_series(0, cardinality(surjections(4))::int - 1) ord $q$);
