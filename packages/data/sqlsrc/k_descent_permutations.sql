-- requires: permutations, statistics, realizer, utilities
-- k_descent_permutations — permutations of [n] with EXACTLY k descents, graded by (n, k). The (n,k) refinement of
-- permutations: fiber (n,k) holds the ⟨n,k⟩ permutations with k descents, where ⟨n,k⟩ is the Eulerian number (the
-- descent triangle, [[OEIS:A008292]]); k ranges 0..n−1. Same carrier + count-triangle pattern as
-- k_cycle_permutations / surjections_onto_k. The floor reuses permutations' lex floor filtered by perm_descents = k.
--
-- Eulerian: ⟨n,k⟩ = (k+1)·⟨n-1,k⟩ + (n-k)·⟨n-1,k-1⟩, ⟨0,0⟩=1, ⟨n,0⟩=1. Tabulated row-by-row, columns capped at k.
CREATE FUNCTION eulerian_number(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE row numeric[] := ARRAY[1::numeric];   -- row[j+1] = ⟨i, j⟩; starts at ⟨0,0⟩=1
          newrow numeric[]; i int; j int; maxk int;
  BEGIN
    IF n < 0 OR k < 0 OR k > n THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN CASE WHEN k = 0 THEN 1 ELSE 0 END; END IF;
    IF k > n - 1 THEN RETURN 0; END IF;                                    -- a length-n word has at most n-1 descents
    FOR i IN 1..n LOOP
      maxk := least(i - 1, k);                                            -- ⟨i,j⟩ nonzero only for j in 0..i-1
      newrow := ARRAY[]::numeric[];
      FOR j IN 0..maxk LOOP
        newrow := newrow || ((j + 1)::numeric * coalesce(row[j+1], 0) + (i - j)::numeric * coalesce(row[j], 0));
      END LOOP;
      row := newrow;
    END LOOP;
    RETURN coalesce(row[k+1], 0);
  END $$;

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
           (ROW(ARRAY[2,1,3])::permutation <@ k_descent_permutations(3,0))::text $q$);
