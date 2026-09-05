-- requires: permutations, realizer, utilities
-- cyclic_permutations — RESTRICTION of permutations: single n-cycles only. Count = (n-1)! for n>=1.
-- A permutation is one n-cycle iff walking image[1] -> image[image[1]] -> ... returns to 1 after exactly n steps
-- (fewer steps means it closed a shorter sub-cycle first, so the permutation decomposes into >1 cycle).

CREATE FUNCTION is_single_cycle(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE walk(step, pos) AS (
    SELECT 1, (p).image[1]
    UNION ALL
    SELECT step + 1, (p).image[pos] FROM walk WHERE pos <> 1
  )
  SELECT max(step) = array_length((p).image, 1) FROM walk WHERE pos = 1 $$;

-- accel hook (#172): an n-cycle count is (n-1)! for n≥1; n=0 has none (no 0-cycle). count_fn is on the parent fiber.
CREATE FUNCTION cyclic_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).size::int = 0 THEN 0::numeric ELSE factorial((f).size::int - 1) END $$;

SELECT base_restrict('cyclic_permutations', 'permutations', 'is_single_cycle', count_fn => 'cyclic_permutation_count');

CREATE FUNCTION fiber_symbol(f cyclic_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Cyc' || to_unicode_subscript((f).size) $$;   -- corpus symbol

SELECT wire_set_notation('cyclic_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('cyclic_permutations','cardinality(cyclic_permutations(n)) = (n-1)! for n=1..5, via the #172 accel','eq','1,1,2,6,24','closed form, no longer a floor scan',$q$
    SELECT string_agg(cardinality(cyclic_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('cyclic_permutations','cyclic_permutations(3) enumerated','eq','231,312','the two 3-cycles, lex order (re-ranked)',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(cyclic_permutations(3)) e $q$),
  ('cyclic_permutations','cyclic_permutations(4) enumerated','eq','2341,2413,3142,3421,4123,4312','the six 4-cycles, lex order (all subsets of the derangements)',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(cyclic_permutations(4)) e $q$),
  ('cyclic_permutations','contains via <@: 4-cycle 2341 in, identity 1234 out','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[2,3,4,1])::permutation <@ cyclic_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ cyclic_permutations(4))::text $q$),
  ('cyclic_permutations','cyclic_permutations(1) is the trivial 1-cycle','eq','1','n=1 identity is vacuously a single cycle',$q$
    SELECT one_line((unrank(cyclic_permutations(1), 0)).value) $q$);
