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
CREATE FUNCTION mahonian_number(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE row numeric[] := ARRAY[1::numeric];   -- row[m+1] = T(0, m); starts at T(0,0)=1
          newrow numeric[]; i int; m int; j int; maxj int; total numeric;
  BEGIN
    IF n < 0 OR k < 0 THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN CASE WHEN k = 0 THEN 1 ELSE 0 END; END IF;
    FOR i IN 1..n LOOP
      newrow := ARRAY[]::numeric[];
      FOR m IN 0..k LOOP
        total := 0;
        maxj := least(m, i - 1);
        FOR j IN 0..maxj LOOP
          total := total + coalesce(row[m - j + 1], 0);
        END LOOP;
        newrow := newrow || total;
      END LOOP;
      row := newrow;
    END LOOP;
    RETURN coalesce(row[k+1], 0);
  END $$;

-- ── the engines a collection provides (n,k) over the permutation carrier ────────────────────────────────
CREATE TYPE k_inversion_permutations_fiber AS (n natural_number, k natural_number);   -- axes: n, k (inversion count)
CREATE FUNCTION fiber_elements(f k_inversion_permutations_fiber, element_limit int) RETURNS SETOF permutation LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::permutations_fiber, 2147483647) v
  WHERE perm_inversions(v) = (f).k::int ORDER BY (v).image LIMIT element_limit $$;
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
  BEGIN
    FOR m IN REVERSE n..1 LOOP                                      -- m = # remaining slots (avail has length m)
      chosen_r := m - 1;                                            -- fallback (only reached if rank was out of range)
      FOR r IN 0..m-1 LOOP
        cnt := mahonian_number(m - 1, remaining_k - r);              -- completions if this step contributes r inversions
        IF remrank < cnt THEN chosen_r := r; EXIT; END IF;
        remrank := remrank - cnt;
      END LOOP;
      res := res || avail[chosen_r + 1];
      avail := avail[1:chosen_r] || avail[chosen_r + 2:array_length(avail,1)];
      remaining_k := remaining_k - chosen_r;
    END LOOP;
    RETURN ROW(res)::permutation;
  END $fu$;
SELECT base_realize('k_inversion_permutations');

-- register with the triangle-slicing machinery: row-sum recovers n! (same as k_descent_permutations / k_cycle_permutations).
INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('k_inversion_permutations', 'n', 'k', 'Mahonian numbers — inversion triangle T(n,k)', 'factorial_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
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
