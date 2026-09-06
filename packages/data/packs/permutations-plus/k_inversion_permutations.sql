-- requires: permutations, statistics, realizer, utilities, triangle_slices
-- k_inversion_permutations — permutations of [n] with EXACTLY k inversions, graded by (n, k). The (n,k) refinement
-- of permutations by the Mahonian statistic: fiber (n,k) holds the T(n,k) permutations with k inversions, where
-- T(n,k) is the Mahonian number — the coefficient of q^k in the q-factorial [n]_q! = Π_{i=1}^{n} (1+q+…+q^{i-1}).
-- k ranges 0..C(n,2) (the maximum, achieved by the fully-reversed permutation). Same carrier + count-triangle
-- pattern as k_descent_permutations / k_cycle_permutations. The floor reuses permutations' lex floor filtered by
-- perm_inversions = k. This closes #216 piece 5 — inversions previously had no triangle, so `dist:inversions`
-- couldn't stream on an open permutations(n) handle.
--
-- Mahonian: T(n,k) = Σ_{j=0}^{min(k,n-1)} T(n-1,k-j), T(0,0)=1. Built row-by-row, columns capped at the target k
-- (only T(i, m) for m=0..k is ever needed to reach T(n,k), so the row array stays length k+1 throughout).
-- The Mahonian triangle T(i, j) = permutations of [i] with j inversions, as ONE flat row-major table:
-- T[i*(k+1) + j + 1]. Two things matter here and both were costing whole orders of magnitude (#307).
--
-- First, each row is a SLIDING WINDOW sum of the one above — T(i, m) = Σ_{j=0..min(m,i-1)} T(i-1, m-j) — so a
-- running total that adds the entering term and drops the leaving one gives a row in O(k), not O(k·min(k,i)).
-- Second, and much worse: mahonian_number rebuilt this whole DP on every call, and fiber_unrank calls it O(n²)
-- times, so a single unrank was rebuilding the triangle n² times over. Building it once and indexing it is the
-- difference between an unrank you can enumerate a fiber with and one you cannot.
CREATE FUNCTION mahonian_table(n int, k int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE t numeric[]; i int; j int; acc numeric; w int := k + 1;
  BEGIN
    IF n < 0 OR k < 0 THEN RETURN ARRAY[]::numeric[]; END IF;
    t := array_fill(0::numeric, ARRAY[(n + 1) * w]);
    t[1] := 1;                                                     -- T(0,0) = 1
    FOR i IN 1..n LOOP
      acc := 0;
      FOR j IN 0..k LOOP
        acc := acc + t[(i - 1) * w + j + 1];                       -- the term entering the window
        IF j >= i THEN acc := acc - t[(i - 1) * w + (j - i) + 1]; END IF;   -- and the one leaving it
        t[i * w + j + 1] := acc;
      END LOOP;
    END LOOP;
    RETURN t;
  END $$;

CREATE FUNCTION mahonian_number(n int, k int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n < 0 OR k < 0 THEN 0::numeric
              WHEN n = 0 THEN CASE WHEN k = 0 THEN 1::numeric ELSE 0::numeric END
              ELSE (mahonian_table(n, k))[n * (k + 1) + k + 1] END $$;

-- ── the engines a collection provides (n,k) over the permutation carrier ────────────────────────────────
CREATE TYPE k_inversion_permutations_fiber AS (n natural_number, k natural_number);   -- axes: n, k (inversion count)
CREATE FUNCTION fiber_count(f k_inversion_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT mahonian_number((f).n::int, (f).k::int) $$;
CREATE FUNCTION contains_in_fiber(f k_inversion_permutations_fiber, v permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::permutations_fiber, v) AND perm_inversions(v) = (f).k::int $$;
CREATE FUNCTION fiber_symbol(f k_inversion_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'M(' || (f).n::int || ',' || (f).k::int || ')' $$;

INSERT INTO base_collection VALUES ('k_inversion_permutations', 'permutation');
INSERT INTO base_grade VALUES ('k_inversion_permutations', 1, 'n', NULL, NULL), ('k_inversion_permutations', 2, 'k', '0', 'g1*(g1-1)/2');   -- k = inversions, 0..C(n,2)

-- direct unrank: a Lehmer-code digit decode, exactly like permutation_unrank_lex, but each digit's WEIGHT is the
-- Mahonian count of completions instead of a factorial — because the Lehmer digit chosen at each step (its 0-indexed
-- rank among the remaining values) is EXACTLY the number of inversions it contributes (that many smaller values are
-- left to appear after it), so inversions decompose additively across positions just like the plain factorial radix.
CREATE FUNCTION fiber_unrank(f k_inversion_permutations_fiber, rank rank_index) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).n::int; avail int[] := ARRAY(SELECT generate_series(1,n)); res int[] := '{}';
          remrank numeric := rank; remaining_k int := (f).k::int; m int; r int; cnt numeric; chosen_r int;
          kmax int := (f).k::int; w int := (f).k::int + 1;
          tbl numeric[] := mahonian_table((f).n::int, (f).k::int);   -- built once; was rebuilt per candidate digit
  BEGIN
    FOR m IN REVERSE n..1 LOOP                                      -- m = # remaining slots (avail has length m)
      chosen_r := m - 1;                                            -- fallback (only reached if rank was out of range)
      FOR r IN 0..m-1 LOOP
        cnt := CASE WHEN remaining_k - r < 0 THEN 0                   -- completions if this step contributes r inversions
                    ELSE tbl[(m - 1) * w + (remaining_k - r) + 1] END;
        IF remrank < cnt THEN chosen_r := r; EXIT; END IF;
        remrank := remrank - cnt;
      END LOOP;
      res := res || avail[chosen_r + 1];
      avail := avail[1:chosen_r] || avail[chosen_r + 2:array_length(avail,1)];
      remaining_k := remaining_k - chosen_r;
    END LOOP;
    RETURN ROW(res)::permutation;
  END $fu$;
-- The floor, built from the unrank above (#307). It used to scan ALL n! permutations and filter on inversion
-- count — 40,320 rebuilt for each of the 29 values of k at n=8 — which is why this collection's accel could
-- never be certified. Ordering by the unrank index is the same lex order the filtered scan produced (the decode
-- is a Lehmer-digit walk), and the Mahonian count bounds the walk, so the window costs what it emits.
--
-- This is the same routing #299 measured and REJECTED as a general rule, and it is right here only because the
-- primitive was fixed first: with mahonian_number rebuilding the DP on every call the unrank floor was 2x
-- SLOWER than the scan (2,320ms -> 4,602ms on one fiber). With the table built once it is ~400x faster per
-- unrank, and the comparison inverts. The lesson is that "unrank vs scan" is not a property of the shape; it is
-- a property of what the unrank costs.
CREATE FUNCTION fiber_elements(f k_inversion_permutations_fiber, element_limit int) RETURNS SETOF permutation LANGUAGE sql STABLE AS $$
  SELECT fiber_unrank(f, i::rank_index)
    FROM generate_series(0, least(mahonian_number((f).n::int, (f).k::int), element_limit::numeric)::bigint - 1) i $$;

SELECT base_realize('k_inversion_permutations');

-- register with the triangle-slicing machinery: row-sum recovers n! (same as k_descent_permutations / k_cycle_permutations).
INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('k_inversion_permutations', 'n', 'k', 'Mahonian numbers — inversion triangle T(n,k)', 'factorial_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_inversion_permutations','the unrank floor enumerates exactly what filtering permutations by inversion count does','eq','true',
   '#307 — the floor no longer scans the parent, so this pins that it yields the same permutations in the same order',
   $q$ SELECT bool_and(same) FROM (
         SELECT (SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e))
                   FROM elements(ROW(n, kk)::k_inversion_permutations_fiber, 2147483647) e)
                IS NOT DISTINCT FROM
                (SELECT string_agg(one_line(v), ',' ORDER BY (v).image)
                   FROM fiber_elements(ROW(n)::permutations_fiber, 2147483647) v WHERE perm_inversions(v) = kk) AS same
           FROM generate_series(0,5) n, generate_series(0, n*(n-1)/2) kk) t $q$),
  ('k_inversion_permutations','the Mahonian triangle rows: n=4 is 1,3,5,6,5,3,1','eq','1,3,5,6,5,3,1',
   'mahonian_table built once and indexed — the row sums to n! and is symmetric',
   $q$ SELECT string_agg(mahonian_number(4,k)::text, ',' ORDER BY k) FROM generate_series(0,6) k $q$),
  ('k_inversion_permutations','the Mahonian triangle T(n,k): row n=4 is 1,3,5,6,5,3,1','eq','1,3,5,6,5,3,1','fiber counts across k=0..6 ([4]_q! coefficients)',$q$
    SELECT string_agg(cardinality(k_inversion_permutations(4,k))::text, ',' ORDER BY k) FROM generate_series(0,6) k $q$),
  ('k_inversion_permutations','k unfolds to n!: |k_inversion_permutations(4)| = Σ_k = 24 = |permutations(4)|','eq','24|24','the (n,k) refinement sums to the n-grading',$q$
    SELECT cardinality(k_inversion_permutations(4))::text || '|' || cardinality(permutations(4))::text $q$),
  ('k_inversion_permutations','fiber (4,0) = the single ascending permutation 1234','eq','1234','zero inversions ⇒ T(4,0)=1',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_inversion_permutations(4,0)) e $q$),
  ('k_inversion_permutations','fiber (4,6) = the single fully-reversed permutation 4321 (max inversions C(4,2)=6)','eq','4321','the top column is always a single element',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_inversion_permutations(4,6)) e $q$),
  ('k_inversion_permutations','fiber (3,1) = the two perms of [3] with one inversion','eq','132,213','T(3,1)=2',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_inversion_permutations(3,1)) e $q$),
  ('k_inversion_permutations','floor count matches the Mahonian accel at (5,4)','eq','true','T(5,4)=22; count of the realized floor = cardinality accel',$q$
    SELECT ((SELECT count(*) FROM elements(k_inversion_permutations(5,4), 2000) e) = cardinality(k_inversion_permutations(5,4)))::text $q$),
  ('k_inversion_permutations','symmetry T(n,k) = T(n,C(n,2)-k): row 4 is a palindrome 1,3,5,6,5,3,1','eq','true','reversing a permutation complements its inversion count',$q$
    SELECT (ARRAY(SELECT cardinality(k_inversion_permutations(4,k)) FROM generate_series(0,6) k)
          = ARRAY(SELECT cardinality(k_inversion_permutations(4,k)) FROM generate_series(6,0,-1) k))::text $q$),
  ('k_inversion_permutations','contains via <@: 213 ∈ (3,1) (one inversion), ∉ (3,0)','eq','true|false','exactly k inversions',$q$
    SELECT (ROW(ARRAY[2,1,3])::permutation <@ k_inversion_permutations(3,1))::text || '|' ||
           (ROW(ARRAY[2,1,3])::permutation <@ k_inversion_permutations(3,0))::text $q$),
  ('k_inversion_permutations','fiber_unrank(k_inversion_permutations(5,4), 0..21) are all members (accel floor)','eq','true','the Lehmer-digit unrank lands inside the T(5,4)=22 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_inversion_permutations(5,4)) f), ord::rank_index) <@ k_inversion_permutations(5,4))::text
      FROM generate_series(0, cardinality(k_inversion_permutations(5,4))::int - 1) ord $q$);
