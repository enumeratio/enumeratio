-- requires: permutations, realizer, utilities
-- alternating_permutations — RESTRICTION of permutations to the UP-DOWN alternating ones: a₁<a₂>a₃<a₄>…
-- (ascent at every odd position, descent at every even position). Counted by the Euler zigzag / secant-tangent
-- numbers A000111: 1,1,1,2,5,16,61,272,… (n=0,1 vacuously alternating). Re-ranked lex within each size fiber.
CREATE FUNCTION is_alternating_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(bool_and(CASE WHEN i % 2 = 1 THEN (p).image[i] < (p).image[i+1]        -- odd position: ascent
                                ELSE (p).image[i] > (p).image[i+1] END), true)           -- even position: descent
  FROM generate_series(1, coalesce(array_length((p).image, 1), 0) - 1) i $$;

SELECT base_restrict('alternating_permutations', 'permutations', 'is_alternating_permutation');

CREATE FUNCTION fiber_symbol(f alternating_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Alt(' || (f).size::int || ')' $$;

SELECT wire_set_notation('alternating_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('alternating_permutations','count = the Euler zigzag A000111 for n=1..6','eq','1,1,2,5,16,61','up-down alternating permutations',$q$
    SELECT string_agg(cardinality(alternating_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('alternating_permutations','alternating_permutations(3) = 132, 231 (a₁<a₂>a₃)','eq','132,231','the two up-down perms of [3], re-ranked lex',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(alternating_permutations(3)) e $q$),
  ('alternating_permutations','contains via <@: 132 ∈, 123 ∉ (2>3 fails at the even position)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,3,2])::permutation <@ alternating_permutations(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ alternating_permutations(3))::text $q$),
  ('alternating_permutations','n=1 is vacuously alternating','eq','1','the singleton',$q$
    SELECT one_line((unrank(alternating_permutations(1), 0)).value) $q$),
  ('alternating_permutations','set_notation renders in its ambient set: 132 ↦ 132 ∈ Alt(3)','eq','132 ∈ Alt(3)','fiber symbol',$q$
    SELECT set_notation(unrank(alternating_permutations(3), 0)) $q$);
