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
