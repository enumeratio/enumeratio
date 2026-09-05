-- requires: permutations, pattern_avoiding_permutations, realizer, utilities
-- smooth_permutations — Av(3412, 4231). By the Lakshmibai–Sandhya theorem (1990) the Schubert variety X_σ ⊂ GL_n/B
-- is smooth iff σ avoids BOTH 3412 and 4231 — pattern avoidance reading off an algebraic-geometry property. Count:
-- 1,1,2,6,22,88,366,1552 for n=0..7 (= 3! for n≤3, since no length-4 pattern fits a shorter permutation). A
-- base_restrict of permutations reusing the O(n⁴) permutation_avoids_pattern4 helper (same one behind separable).

CREATE FUNCTION is_smooth_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT permutation_avoids_pattern4(p,3,4,1,2) AND permutation_avoids_pattern4(p,4,2,3,1) $$;

SELECT base_restrict('smooth_permutations', 'permutations', 'is_smooth_permutation');
CREATE FUNCTION fiber_symbol(f smooth_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Smooth(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('smooth_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('smooth_permutations','count |Av(3412,4231)| for n=0..7: 1,1,2,6,22,88,366,1552','eq','1,1,2,6,22,88,366,1552','the smooth permutations (Lakshmibai–Sandhya)',$q$
    SELECT string_agg(cardinality(smooth_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,7) n $q$),
  ('smooth_permutations','n≤3 gives all n!: every permutation is smooth (no length-4 pattern possible)','eq','1,2,6','|smooth(1..3)| = |S_1|,|S_2|,|S_3|',$q$
    SELECT string_agg(cardinality(smooth_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,3) n $q$),
  ('smooth_permutations','contains via <@: 1234 ∈; the forbidden 3412 and 4231 ∉','eq','true|false|false','derived membership = parent ∧ avoids both patterns',$q$
    SELECT (ROW(ARRAY[1,2,3,4])::permutation <@ smooth_permutations(4))::text || '|' ||
           (ROW(ARRAY[3,4,1,2])::permutation <@ smooth_permutations(4))::text || '|' ||
           (ROW(ARRAY[4,2,3,1])::permutation <@ smooth_permutations(4))::text $q$),
  ('smooth_permutations','smooth(4) = the 22 survivors of S_4 (24 minus 3412, 4231)','eq','22','|S_4| − 2',$q$
    SELECT cardinality(smooth_permutations(4))::text $q$);
