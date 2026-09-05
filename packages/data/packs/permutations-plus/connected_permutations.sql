-- requires: permutations, realizer, utilities
-- connected_permutations — RESTRICTION of permutations to the INDECOMPOSABLE ones: no proper prefix [1..k] (k<n)
-- maps onto {1..k}. Equivalently max(image[1..k]) > k for every k < n. Count A003319: 1,1,3,13,71,461,… Re-ranked lex.
CREATE FUNCTION is_connected_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_series(1, coalesce(array_length((p).image, 1), 0) - 1) k
    WHERE (SELECT max(x) FROM unnest((p).image[1:k]) AS x) = k) $$;         -- a prefix that stays within [1..k] ⇒ decomposable

SELECT base_restrict('connected_permutations', 'permutations', 'is_connected_permutation');

CREATE FUNCTION fiber_symbol(f connected_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Conn(' || (f).size::int || ')' $$;

SELECT wire_set_notation('connected_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('connected_permutations','count = A003319 for n=1..6','eq','1,1,3,13,71,461','indecomposable permutations',$q$
    SELECT string_agg(cardinality(connected_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('connected_permutations','connected_permutations(3) = 231, 312, 321','eq','231,312,321','the indecomposable perms of [3], re-ranked lex',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(connected_permutations(3)) e $q$),
  ('connected_permutations','contains via <@: 231 ∈, 213 ∉ (prefix {2,1} = [1..2])','eq','true|false','derived membership',$q$
    SELECT (ROW(ARRAY[2,3,1])::permutation <@ connected_permutations(3))::text || '|' ||
           (ROW(ARRAY[2,1,3])::permutation <@ connected_permutations(3))::text $q$);
