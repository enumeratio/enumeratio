-- requires: realizer, utilities
-- parking_functions — a parking function of length n is a sequence (a_1,...,a_n) with each a_i in [1,n] such
-- that its sorted rearrangement b_1<=...<=b_n satisfies b_i <= i for all i (n cars each drive to their
-- preferred spot a_i, park at the next free spot at or after it; a parking function is a preference sequence
-- for which every car finds a spot in a garage of exactly n spots). Single grade [n]. Count is (n+1)^(n-1):
-- 1,3,16,125,1296 for n=1..5. Provides the floor (build all n-tuples over [1,n] part-by-part, keep those
-- satisfying the parking condition, emit in lex order of the spots array) + a contains engine + a fiber_count
-- accel: pow_int(n+1, n-1) — n=0 gives exponent -1, but pow_int's ascending FOR loop just never iterates,
-- returning its seed 1, which is exactly the n=0 count (the one empty sequence) — so the "awkward" n=0 case
-- turns out to need no special-casing at all (#284).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE parking_function AS (spots int[]);                        -- preference sequence; {1,2} = car1→1, car2→2
CREATE FUNCTION notation(p parking_function) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((p).spots, ',') $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every length-n sequence over [1,n], built part-by-part, filtered to the parking condition, emitted
-- in lex order of the spots array. The parking condition is checked by sorting a copy of the sequence (via
-- row_number() ordered by value, 1-indexed) and requiring each sorted value not exceed its rank.
CREATE TYPE parking_functions_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f parking_functions_fiber, element_limit int) RETURNS SETOF parking_function LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build(spots, len) AS (
      SELECT ARRAY[]::int[], 0
    UNION ALL
      SELECT b.spots || a, b.len + 1
      FROM build b, LATERAL generate_series(1, (f).n::int) a
      WHERE b.len < (f).n::int
  )
  SELECT ROW(spots)::parking_function FROM build
  WHERE len = (f).n::int
    AND NOT EXISTS (                                            -- sorted b_i <= i (i = rank, 1-indexed)
      SELECT 1 FROM (SELECT x, row_number() OVER (ORDER BY x) AS i FROM unnest(spots) AS x) sorted
      WHERE sorted.x > sorted.i
    )
  ORDER BY spots
  LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f parking_functions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int((f).n::int + 1, (f).n::int - 1) $$;

-- contains: v is a parking function of length n iff it has exactly n entries, each in [1,n], and its sorted
-- rearrangement satisfies b_i <= i.
CREATE FUNCTION contains_in_fiber(f parking_functions_fiber, v parking_function) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).spots, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).spots) x WHERE x < 1 OR x > (f).n::int)
     AND NOT EXISTS (
       SELECT 1 FROM (SELECT x, row_number() OVER (ORDER BY x) AS i FROM unnest((v).spots) AS x) sorted
       WHERE sorted.x > sorted.i
     ) $$;

-- ── unrank: completion-count DP against the generator's exact lex-over-spots order ──────────────────────
-- A sequence is a parking function of length n iff its sorted rearrangement b satisfies b_i<=i for all i,
-- an equivalent CDF condition that depends only on which VALUES appear (any order of a fixed multiset is
-- equally valid or invalid) — so "how many valid completions remain" after fixing a prefix depends only on
-- that prefix's per-threshold cumulative count `cum[t]` = #{fixed values <= t}, not on the order they were
-- fixed in. parking_function_completions computes, for m still-unassigned positions (each free to take any
-- value in [1,n]) and a given cum, the exact count of completions whose FINAL combined CDF dominates the
-- identity (cum[t] + #{new values <= t} >= t for every t=1..n) — an integer DP processing thresholds
-- t=1..n, tracking only "how many of the m positions have been assigned a value <= t so far" (0..m): to
-- assign x of the still-unassigned positions to value t, choose which x of the (m − already-assigned)
-- positions via a plain binomial (positions are otherwise interchangeable within a threshold, since they'd
-- all get the same value) — no factorials/division needed, so it stays exact integer arithmetic. A cell is
-- pruned to 0 the moment its running count falls short of `t − cum[t]` (the deficiency can never be made up
-- by later, larger-valued assignments, since CDF(t) is fixed once thresholds ≤ t are done).
CREATE FUNCTION parking_function_completions(cum int[], n int, m int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE prev numeric[] := array_fill(0::numeric, ARRAY[m+1]); curr numeric[]; t int; c int; x int; req int; s numeric;
  BEGIN
    prev[1] := 1;                                              -- h[0][0] = 1 (no thresholds processed, 0 assigned)
    FOR t IN 1..n LOOP
      req := greatest(0, t - cum[t]);                          -- deficiency still owed at threshold t
      curr := array_fill(0::numeric, ARRAY[m+1]);
      FOR c IN 0..m LOOP
        IF c < req THEN CONTINUE; END IF;                      -- unrecoverable shortfall — leave pruned at 0
        s := 0;
        FOR x IN 0..c LOOP                                     -- x of the m positions get value t this round
          IF prev[c-x+1] <> 0 THEN s := s + prev[c-x+1] * binomial(m-(c-x), x); END IF;
        END LOOP;
        curr[c+1] := s;
      END LOOP;
      prev := curr;
    END LOOP;
    RETURN prev[m+1];                                          -- h[n][m]: all m positions assigned, every threshold satisfied
  END $$;

-- Position-by-position trie decode: at each of the n positions, try candidate values w=1..n ascending
-- (matching the generator's lex order), price each by its completion count (cum updated as if w were
-- fixed), and descend/subtract exactly as a combinatorial-number-system unrank does.
CREATE FUNCTION parking_function_unrank(n int, ord bigint) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE cum int[] := array_fill(0, ARRAY[n]); spots int[] := '{}'; k int; m int; w int; new_cum int[]; cnt numeric; x numeric := ord; t int;
  BEGIN
    IF n = 0 THEN RETURN spots; END IF;
    FOR k IN 0..n-1 LOOP
      m := n - k;                                              -- remaining positions, including this one
      FOR w IN 1..n LOOP
        new_cum := cum;
        FOR t IN w..n LOOP new_cum[t] := new_cum[t] + 1; END LOOP;
        cnt := parking_function_completions(new_cum, n, m - 1);
        IF x < cnt THEN
          spots := spots || w; cum := new_cum; EXIT;
        ELSE
          x := x - cnt;
        END IF;
      END LOOP;
    END LOOP;
    RETURN spots;
  END $$;
CREATE FUNCTION fiber_unrank(f parking_functions_fiber, rank rank_index) RETURNS parking_function LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(parking_function_unrank((f).n::int, rank::bigint))::parking_function $fu$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('parking_functions', 'parking_function');
INSERT INTO base_grade VALUES ('parking_functions', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f parking_functions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Park(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('parking_functions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('parking_functions','cardinality anchor = (n+1)^(n-1) for n=1..5 (accel: pow_int)','eq','1,3,16,125,1296','2^1,3^1,4^2,5^3,6^4',$q$
    SELECT string_agg(cardinality(parking_functions(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),

  ('parking_functions','cardinality(parking_functions(10)) = 11^9 = 2357947691 (accel only — the floor of ~2.4 billion candidates is infeasible to enumerate)','eq','2357947691','(10+1)^(10-1), closed form',$q$
    SELECT cardinality(parking_functions(10))::text $q$),
  ('parking_functions','n=0 ⇒ one empty parking function','eq','1|','the empty sequence, vacuously valid',$q$
    SELECT count(*)::text || '|' || notation((unrank(parking_functions(0), 0)).value) FROM elements(parking_functions(0)) e $q$),
  ('parking_functions','n=2 in lex order','eq','1,1,1,2,2,1','the three parking functions of length 2',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(parking_functions(2)) e $q$),
  ('parking_functions','n=3 has 16 parking functions (floor count)','eq','16','independent check via count(*)',$q$
    SELECT count(*)::text FROM elements(parking_functions(3)) e $q$),
  ('parking_functions','every element of the n=3 fiber satisfies the parking condition','eq','true','sorted b_i <= i, structural invariant',$q$
    SELECT bool_and(
        array_length(((e).value).spots, 1) = 3
        AND NOT EXISTS (
          SELECT 1 FROM (SELECT x, row_number() OVER (ORDER BY x) AS i FROM unnest(((e).value).spots) AS x) sorted
          WHERE sorted.x > sorted.i
        )
      )::text FROM elements(parking_functions(3)) e $q$),
  ('parking_functions','unrank first/last of n=2','eq','1,1|2,1','ranks 0 and 2 in lex order',$q$
    SELECT notation((unrank(parking_functions(2), 0)).value) || '|' ||
           notation((unrank(parking_functions(2), 2)).value) $q$),
  ('parking_functions','element carries a TYPED point fiber + ordinality','eq','2|1','unrank(parking_functions(2),1)',$q$
    SELECT (unrank(parking_functions(2), 1)).fiber.n::text || '|' || ordinality(unrank(parking_functions(2), 1))::text $q$),
  ('parking_functions','contains: {1,2} ∈ parking_functions(2), {2,2} ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,2])::parking_function <@ parking_functions(2))::text || '|' ||
           (ROW(ARRAY[2,2])::parking_function <@ parking_functions(2))::text $q$),

  ('parking_functions','fiber_unrank(parking_functions(4), 0..cardinality-1) are all members (accel floor)','eq','true','completion-count DP lands inside the fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(parking_functions(4)) f), ord::rank_index) <@ parking_functions(4))::text
      FROM generate_series(0, cardinality(parking_functions(4))::int - 1) ord $q$),
  ('parking_functions','fiber_unrank reproduces the floor''s exact lex-over-spots order for n=3 (16 elements)','eq','true','accel == naive enumeration order, element by element',$q$
    SELECT bool_and(notation((unrank(parking_functions(3), ordinality(e)::rank_index)).value) = notation((e).value))::text
      FROM elements(parking_functions(3)) e $q$);
