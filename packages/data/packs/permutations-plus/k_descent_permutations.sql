-- requires: permutations, statistics, realizer, utilities
-- k_descent_permutations — permutations of [n] with EXACTLY k descents, graded by (n, k). The (n,k) refinement of
-- permutations: fiber (n,k) holds the ⟨n,k⟩ permutations with k descents, where ⟨n,k⟩ is the Eulerian number (the
-- descent triangle, [[OEIS:A008292]]); k ranges 0..n−1. Same carrier + count-triangle pattern as
-- k_cycle_permutations / surjections_onto_k. The floor reuses permutations' lex floor filtered by perm_descents = k.
--
-- Eulerian: ⟨n,k⟩ = (k+1)·⟨n-1,k⟩ + (n-k)·⟨n-1,k-1⟩, ⟨0,0⟩=1, ⟨n,0⟩=1. Tabulated row-by-row, columns capped at k.
-- eulerian_number itself is hoisted into core's utilities.sql (#283 phase 3) because core's generating_functions.sql
-- (gf_eulerian_row) reuses it — same shape as binomial/factorial living there.

-- ── the engines a collection provides (n,k) over the permutation carrier ────────────────────────────────
CREATE TYPE k_descent_permutations_fiber AS (n natural_number, k natural_number);   -- axes: n, k (descent count)
CREATE FUNCTION fiber_elements(f k_descent_permutations_fiber, element_limit int) RETURNS SETOF permutation LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::permutations_fiber, 2147483647) v
  WHERE perm_descents(v) = (f).k::int ORDER BY (v).image LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_descent_permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT eulerian_number((f).n::int, (f).k::int) $$;   -- ⟨n,k⟩, Eulerian
CREATE FUNCTION contains_in_fiber(f k_descent_permutations_fiber, v permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::permutations_fiber, v) AND perm_descents(v) = (f).k::int $$;
CREATE FUNCTION fiber_symbol(f k_descent_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'A(' || (f).n::int || ',' || (f).k::int || ')' $$;

INSERT INTO base_collection VALUES ('k_descent_permutations', 'permutation');
INSERT INTO base_grade VALUES ('k_descent_permutations', 1, 'n', NULL, NULL), ('k_descent_permutations', 2, 'k', '0', 'greatest(g1 - 1, 0)');   -- k = descents, 0..n-1

-- direct unrank: unlike inversions, a descent depends on comparing TWO consecutive chosen values, so the digit
-- picked at a step doesn't contribute a fixed count on its own — it needs the state "a" = the 0-indexed rank of the
-- PREVIOUS chosen value among the values still available at this step (avail is disjoint from prev, so a ranges
-- 0..m where m=|avail|). Picking the digit at rank r (0-indexed within avail) creates a descent iff r < a — a
-- smaller remaining value than prev. Removing it leaves a NEW previous-rank a' = r exactly (nothing smaller than
-- the removed value changes rank). So: g(m,a,d) = # ways to arrange m remaining values, given previous-rank a,
-- creating exactly d further descents = Σ_{r=0}^{m-1} g(m-1, r, d - [r<a]); g(0,0,0)=1. The first digit (no
-- previous) draws directly from g(n-1, r, k). This is the same "insertion-relative-rank" recursion that proves the
-- Eulerian numbers; verified by hand against ⟨2,·⟩ and ⟨3,1⟩=4 before coding, and selfcert checks it exhaustively.
CREATE FUNCTION fiber_unrank(f k_descent_permutations_fiber, rank rank_index) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $fu$
  DECLARE n int := (f).n::int; k int := (f).k::int; stride int := (n + 1) * (k + 1);
          flat numeric[] := ARRAY[]::numeric[];                     -- flat[m*stride + a*(k+1) + d + 1] = g(m,a,d)
          avail int[] := ARRAY(SELECT generate_series(1,n)); res int[] := '{}';
          remrank numeric := rank; remaining_k int; cur_a int; m int; a int; d int; r int; total numeric; cnt numeric;
          chosen_r int; need_descent boolean;
  BEGIN
    IF n = 0 THEN RETURN ROW(ARRAY[]::int[])::permutation; END IF;
    -- level m=0: only (a=0,d=0) survives
    FOR a IN 0..n LOOP FOR d IN 0..k LOOP
      flat[a*(k+1) + d + 1] := CASE WHEN a = 0 AND d = 0 THEN 1::numeric ELSE 0::numeric END;
    END LOOP; END LOOP;
    FOR m IN 1..n-1 LOOP
      FOR a IN 0..n LOOP FOR d IN 0..k LOOP
        IF a > m THEN total := 0;
        ELSE
          total := 0;
          FOR r IN 0..m-1 LOOP
            IF r < a THEN
              IF d >= 1 THEN total := total + flat[(m-1)*stride + r*(k+1) + (d-1) + 1]; END IF;
            ELSE total := total + flat[(m-1)*stride + r*(k+1) + d + 1];
            END IF;
          END LOOP;
        END IF;
        flat[m*stride + a*(k+1) + d + 1] := total;
      END LOOP; END LOOP;
    END LOOP;
    -- decode: first digit draws from level (n-1), no previous-rank constraint
    remaining_k := k; chosen_r := n - 1;
    FOR r IN 0..n-1 LOOP
      cnt := flat[(n-1)*stride + r*(k+1) + remaining_k + 1];
      IF remrank < cnt THEN chosen_r := r; EXIT; END IF;
      remrank := remrank - cnt;
    END LOOP;
    res := res || avail[chosen_r + 1]; avail := avail[1:chosen_r] || avail[chosen_r + 2:array_length(avail,1)];
    cur_a := chosen_r;
    FOR m IN REVERSE (n-1)..1 LOOP                                  -- m = # remaining slots BEFORE this pick
      chosen_r := m - 1;
      FOR r IN 0..m-1 LOOP
        need_descent := r < cur_a;
        IF need_descent THEN
          cnt := CASE WHEN remaining_k >= 1 THEN flat[(m-1)*stride + r*(k+1) + (remaining_k-1) + 1] ELSE 0 END;
        ELSE cnt := flat[(m-1)*stride + r*(k+1) + remaining_k + 1];
        END IF;
        IF remrank < cnt THEN
          chosen_r := r; IF need_descent THEN remaining_k := remaining_k - 1; END IF; EXIT;
        END IF;
        remrank := remrank - cnt;
      END LOOP;
      res := res || avail[chosen_r + 1]; avail := avail[1:chosen_r] || avail[chosen_r + 2:array_length(avail,1)];
      cur_a := chosen_r;
    END LOOP;
    RETURN ROW(res)::permutation;
  END $fu$;
SELECT base_realize('k_descent_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_descent_permutations','the Eulerian triangle ⟨n,k⟩: row n=4 is 1,11,11,1','eq','1,11,11,1','fiber counts across k=0..3 (A008292)',$q$
    SELECT string_agg(cardinality(k_descent_permutations(4,k))::text, ',' ORDER BY k) FROM generate_series(0,3) k $q$),
  ('k_descent_permutations','k unfolds to n!: |k_descent_permutations(4)| = Σ_k = 24 = |permutations(4)|','eq','24|24','the (n,k) refinement sums to the n-grading',$q$
    SELECT cardinality(k_descent_permutations(4))::text || '|' || cardinality(permutations(4))::text $q$),
  ('k_descent_permutations','fiber (4,0) = the single ascending permutation 1234','eq','1234','zero descents ⇒ ⟨4,0⟩=1',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_descent_permutations(4,0)) e $q$),
  ('k_descent_permutations','fiber (3,1) = the four perms of [3] with one descent','eq','132,213,231,312','⟨3,1⟩=4',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_descent_permutations(3,1)) e $q$),
  ('k_descent_permutations','floor count matches the Eulerian accel at (5,2)','eq','true','⟨5,2⟩=66; count of the realized floor = cardinality accel',$q$
    SELECT ((SELECT count(*) FROM elements(k_descent_permutations(5,2), 2000) e) = cardinality(k_descent_permutations(5,2)))::text $q$),
  ('k_descent_permutations','symmetry ⟨n,k⟩ = ⟨n,n-1-k⟩: row 5 is 1,26,66,26,1 (palindrome)','eq','1,26,66,26,1','the reverse-complement involution on descents',$q$
    SELECT string_agg(cardinality(k_descent_permutations(5,k))::text, ',' ORDER BY k) FROM generate_series(0,4) k $q$),
  ('k_descent_permutations','contains via <@: 213 ∈ (3,1) (one descent), ∉ (3,0)','eq','true|false','exactly k descents',$q$
    SELECT (ROW(ARRAY[2,1,3])::permutation <@ k_descent_permutations(3,1))::text || '|' ||
           (ROW(ARRAY[2,1,3])::permutation <@ k_descent_permutations(3,0))::text $q$),
  ('k_descent_permutations','fiber_unrank(k_descent_permutations(5,2), 0..65) are all members (accel floor)','eq','true','the previous-rank descent unrank lands inside the ⟨5,2⟩=66 fiber for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(k_descent_permutations(5,2)) f), ord::rank_index) <@ k_descent_permutations(5,2))::text
      FROM generate_series(0, cardinality(k_descent_permutations(5,2))::int - 1) ord $q$);
