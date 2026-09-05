-- requires: permutations, realizer, utilities
-- cograssmannian_permutations — RESTRICTION of permutations to those with AT MOST ONE ASCENT (a_i < a_{i+1} for at
-- most one i): the Poincaré dual of the Grassmannian permutations (complement-reverse). Count = 2ⁿ − n. Re-ranked lex.
CREATE FUNCTION is_cograssmannian_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE (p).image[i] < (p).image[i+1]), 0) <= 1
  FROM generate_series(1, coalesce(array_length((p).image, 1), 0) - 1) i $$;

-- accel hook (#172): the dual has the same count as grassmannian — |CoGr(n)| = 2ⁿ − n (count_fn on the parent fiber).
CREATE FUNCTION cograssmannian_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT pow_int(2, (f).size::int) - (f).size::int $$;

SELECT base_restrict('cograssmannian_permutations', 'permutations', 'is_cograssmannian_permutation', count_fn => 'cograssmannian_permutation_count');

CREATE FUNCTION fiber_symbol(f cograssmannian_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'CoGr(' || (f).size::int || ')' $$;

SELECT wire_set_notation('cograssmannian_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('cograssmannian_permutations','count = 2ⁿ − n for n=1..6 (same as grassmannian, the dual)','eq','1,2,5,12,27,58','at most one ascent',$q$
    SELECT string_agg(cardinality(cograssmannian_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('cograssmannian_permutations','cograssmannian_permutations(3) = all but 123','eq','132,213,231,312,321','the ≤1-ascent perms of [3], re-ranked lex',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(cograssmannian_permutations(3)) e $q$),
  ('cograssmannian_permutations','contains via <@: 321 ∈ (zero ascents), 123 ∉ (two ascents)','eq','true|false','dual of grassmannian',$q$
    SELECT (ROW(ARRAY[3,2,1])::permutation <@ cograssmannian_permutations(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ cograssmannian_permutations(3))::text $q$),
  ('cograssmannian_permutations','set_notation: rank 4 is 321 ↦ 321 ∈ CoGr(3)','eq','321 ∈ CoGr(3)','fiber symbol matches numbers'' CoGr(n)',$q$
    SELECT set_notation(unrank(cograssmannian_permutations(3), 4)) $q$);
