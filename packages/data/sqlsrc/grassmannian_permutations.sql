-- requires: permutations, realizer, utilities
-- grassmannian_permutations — RESTRICTION of permutations to those with AT MOST ONE descent (a_i > a_{i+1} for at
-- most one i). The Grassmannian permutations of Schubert calculus; count = 2ⁿ − n (1,2,5,12,27,58,…). Re-ranked lex.
CREATE FUNCTION is_grassmannian_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE (p).image[i] > (p).image[i+1]), 0) <= 1
  FROM generate_series(1, coalesce(array_length((p).image, 1), 0) - 1) i $$;

-- accel hook (#172): |Gr(n)| = 2ⁿ − n (count_fn on the parent fiber).
CREATE FUNCTION grassmannian_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int(2, (f).size::int) - (f).size::int $$;

SELECT base_restrict('grassmannian_permutations', 'permutations', 'is_grassmannian_permutation', count_fn => 'grassmannian_permutation_count');

CREATE FUNCTION fiber_symbol(f grassmannian_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Gr(' || (f).size::int || ')' $$;

SELECT wire_set_notation('grassmannian_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('grassmannian_permutations','count = 2ⁿ − n for n=1..6','eq','1,2,5,12,27,58','at most one descent',$q$
    SELECT string_agg(cardinality(grassmannian_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('grassmannian_permutations','grassmannian_permutations(3) = all but 321','eq','123,132,213,231,312','the ≤1-descent perms of [3], re-ranked lex',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(grassmannian_permutations(3)) e $q$),
  ('grassmannian_permutations','contains via <@: 231 ∈ (one descent), 321 ∉ (two descents)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[2,3,1])::permutation <@ grassmannian_permutations(3))::text || '|' ||
           (ROW(ARRAY[3,2,1])::permutation <@ grassmannian_permutations(3))::text $q$),
  ('grassmannian_permutations','set_notation: rank 3 is 231 ↦ 231 ∈ Gr(3)','eq','231 ∈ Gr(3)','fiber symbol matches numbers'' Gr(n)',$q$
    SELECT set_notation(unrank(grassmannian_permutations(3), 3)) $q$);
