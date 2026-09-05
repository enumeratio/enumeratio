-- requires: permutations, statistics, realizer, utilities
-- k_cycle_permutations — permutations of [n] with EXACTLY k cycles, graded by (n, k). The (n,k) refinement of
-- permutations (which grades by n alone, summing over k = n!) — fiber (n,k) holds the c(n,k) permutations with k
-- cycles, where c(n,k) is the unsigned Stirling number of the FIRST kind (the cycle triangle, [[OEIS:A132393]]).
-- It is to permutations what set_partitions_into_k_blocks is to set_partitions: the same carrier + count-triangle
-- pattern (surjections_onto_k.sql). The floor reuses permutations' lex floor filtered by perm_cycle_count = k.
--
-- Unsigned Stirling-1: c(n,k) = c(n-1,k-1) + (n-1)·c(n-1,k), c(0,0)=1, c(n,0)=0 for n>0. Tabulated row-by-row,
-- columns capped at k (higher columns never feed c(·,≤k)) — mirrors stirling_second in set_partitions_into_k_blocks.
CREATE FUNCTION stirling_first_unsigned(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE row numeric[] := ARRAY[1::numeric];   -- row[j+1] = c(i, j); starts at c(0,0)=1
          newrow numeric[]; i int; j int; maxk int;
  BEGIN
    IF n < 0 OR k < 0 OR k > n THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;                                        -- only (0,0) survives
    FOR i IN 1..n LOOP
      maxk := least(i, k);
      newrow := ARRAY[]::numeric[];
      FOR j IN 0..maxk LOOP
        newrow := newrow || (CASE WHEN j = 0 THEN 0::numeric                                -- c(i,0)=0 for i>0
                                   ELSE coalesce(row[j], 0) + (i - 1)::numeric * coalesce(row[j+1], 0) END);
      END LOOP;
      row := newrow;
    END LOOP;
    RETURN row[k+1];
  END $$;

-- ── the engines a collection provides (n,k) over the permutation carrier ────────────────────────────────
CREATE TYPE k_cycle_permutations_fiber AS (n natural_number, k natural_number);   -- axes: n, k (cycle count)
CREATE FUNCTION fiber_elements(f k_cycle_permutations_fiber, element_limit int) RETURNS SETOF permutation LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::permutations_fiber, 2147483647) v
  WHERE perm_cycle_count(v) = (f).k::int ORDER BY (v).image LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_cycle_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT stirling_first_unsigned((f).n::int, (f).k::int) $$;   -- c(n,k), unsigned Stirling-1
CREATE FUNCTION contains_in_fiber(f k_cycle_permutations_fiber, v permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::permutations_fiber, v) AND perm_cycle_count(v) = (f).k::int $$;
CREATE FUNCTION fiber_symbol(f k_cycle_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'c(' || (f).n::int || ',' || (f).k::int || ')' $$;

-- ── fiber_unrank: direct decode in LEX-BY-IMAGE order (the floor's own order, not cycle-construction order) ──
-- The floor sorts by one-line image, so unrank must build σ(1),σ(2),...,σ(n) left to right. The trick: at the
-- step assigning σ(i), the partial functional graph on {1..n} is always a disjoint union of open "chains"
-- (nodes touched so far, one root + one dangling tail each) plus already-closed cycles, and — the key
-- invariant — the number of open chains after i-1 steps is ALWAYS exactly n-i+1, independent of which values
-- were chosen. Node i is always the current tail of some chain (freshly singleton if untouched); call its
-- root R_i. Scanning the remaining available values v ascending (= the roots of every open chain, one each):
--   v = R_i        → CLOSES i's own chain into a cycle;      completions = c(n-i, k_remaining-1)
--   v = some other root R_other (chain tail T_other) → MERGES the two chains (root stays R_i, tail becomes
--                     T_other), no closure;                  completions = c(n-i, k_remaining)
-- (c = stirling_first_unsigned, reusing the fiber_count accel above.) Both branch counts follow the SAME
-- recurrence as c(n,k) itself (verified by hand against c(4,2)=11 and against the fiber(4,1) lex listing in
-- the examples below), because which specific chain got merged never affects how many ways remain to finish —
-- only whether a closure happened. That's what makes this decodable digit-by-digit despite the lex order not
-- being the cycle-construction order.
CREATE FUNCTION fiber_unrank(f k_cycle_permutations_fiber, rank rank_index) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).n::int; kneed int := (f).k::int; r numeric := rank::numeric;
          image int[] := ARRAY[]::int[];
          root_of_node int[]; tail_of_root int[]; is_open_root boolean[];
          i int; v int; own_root int; rem int; cnt numeric; chosen int; other_tail int;
  BEGIN
    root_of_node := ARRAY(SELECT g FROM generate_series(1, n) g);          -- root_of_node[v] = v initially (singletons)
    tail_of_root := ARRAY(SELECT g FROM generate_series(1, n) g);          -- tail_of_root[v] = v initially
    is_open_root := ARRAY(SELECT true FROM generate_series(1, n) g);
    FOR i IN 1..n LOOP
      own_root := root_of_node[i];
      rem := n - i;                                                       -- positions AFTER this one
      chosen := NULL;
      FOR v IN 1..n LOOP
        IF NOT is_open_root[v] THEN CONTINUE; END IF;
        cnt := CASE WHEN v = own_root THEN stirling_first_unsigned(rem, kneed - 1)
                    ELSE stirling_first_unsigned(rem, kneed) END;
        IF r < cnt THEN chosen := v; EXIT; END IF;
        r := r - cnt;
      END LOOP;
      IF chosen IS NULL THEN RETURN NULL; END IF;                         -- rank out of range
      image := image || chosen;
      IF chosen = own_root THEN
        is_open_root[own_root] := false;                                  -- chain closes into a completed cycle
        kneed := kneed - 1;
      ELSE
        other_tail := tail_of_root[chosen];
        tail_of_root[own_root] := other_tail;                             -- merge: root stays own_root, tail moves
        root_of_node[other_tail] := own_root;
        is_open_root[chosen] := false;                                    -- absorbed, no longer an independent root
      END IF;
    END LOOP;
    RETURN ROW(image)::permutation;
  END $fu$;

INSERT INTO base_collection VALUES ('k_cycle_permutations', 'permutation');
INSERT INTO base_grade VALUES ('k_cycle_permutations', 1, 'n', NULL, NULL), ('k_cycle_permutations', 2, 'k', '0', 'g1');   -- k = cycle count, 0..n
SELECT base_realize('k_cycle_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_cycle_permutations','the cycle triangle c(n,k): row n=4 is 6,11,6,1 (unsigned Stirling-1)','eq','6,11,6,1','fiber counts across k=1..4',$q$
    SELECT string_agg(cardinality(k_cycle_permutations(4,k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('k_cycle_permutations','k unfolds to n!: |k_cycle_permutations(4)| = Σ_k = 24 = |permutations(4)|','eq','24|24','the (n,k) refinement sums to the n-grading',$q$
    SELECT cardinality(k_cycle_permutations(4))::text || '|' || cardinality(permutations(4))::text $q$),
  ('k_cycle_permutations','fiber (4,1) = the 6 four-cycles, in lex order','eq','2341,2413,3142,3421,4123,4312','a single n-cycle ⇒ c(4,1)=6',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_cycle_permutations(4,1)) e $q$),
  ('k_cycle_permutations','floor count matches the Stirling-1 accel at (5,2)','eq','true','c(5,2)=50; count of the realized floor = cardinality accel',$q$
    SELECT ((SELECT count(*) FROM elements(k_cycle_permutations(5,2), 2000) e) = cardinality(k_cycle_permutations(5,2)))::text $q$),
  ('k_cycle_permutations','fiber = (n,k) typed axes; unrank(k_cycle_permutations(4,2),0).fiber','eq','4|2','the two grades',$q$
    SELECT (unrank(k_cycle_permutations(4,2),0)).fiber.n::text || '|' || (unrank(k_cycle_permutations(4,2),0)).fiber.k::text $q$),
  ('k_cycle_permutations','contains via <@: identity 123 ∈ (3,3) (3 fixed points), ∉ (3,1)','eq','true|false','exactly k cycles',$q$
    SELECT (ROW(ARRAY[1,2,3])::permutation <@ k_cycle_permutations(3,3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ k_cycle_permutations(3,1))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_cycle_permutations','fiber_unrank(k_cycle_permutations(4,1), 0..5) reproduces the lex listing exactly','eq','2341,2413,3142,3421,4123,4312','the chain-merge DP decode, digit by digit, against the naive floor',$q$
    SELECT string_agg(one_line(fiber_unrank((SELECT f FROM fibers(k_cycle_permutations(4,1)) f), ord::rank_index)), ','  ORDER BY ord)
      FROM generate_series(0, cardinality(k_cycle_permutations(4,1))::int - 1) ord $q$),
  ('k_cycle_permutations','fiber_unrank(k_cycle_permutations(6,3), 0..) matches the naive floor at every rank','eq','true','accel==naive differential over a fiber with merges AND closures at every step',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_cycle_permutations(6,3)) f), ordinality(e)::rank_index) = (e).value)::text
      FROM elements(k_cycle_permutations(6,3), 2000) e $q$),
  ('k_cycle_permutations','fiber_unrank(k_cycle_permutations(5,k), 0..) lands inside its own fiber for every k','eq','true','membership: the accel floor is always a member of the fiber it was decoded for',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_cycle_permutations(5,k)) f), ord::rank_index) <@ k_cycle_permutations(5,k))::text
      FROM generate_series(1,5) k, LATERAL generate_series(0, cardinality(k_cycle_permutations(5,k))::int - 1) ord $q$);
