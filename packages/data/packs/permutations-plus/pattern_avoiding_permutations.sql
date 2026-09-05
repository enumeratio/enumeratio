-- requires: permutations, catalan_numbers, schroeder_numbers, realizer, utilities
-- Pattern-avoiding permutations — Av(σ) for each length-3 pattern σ. A permutation avoids σ if it has no subsequence
-- order-isomorphic to σ. KNUTH'S THEOREM: avoiding ANY single length-3 pattern gives Catalan(n); the six classes are
-- WILF-EQUIVALENT — identical counts, genuinely different sets. This is the bridge from permutations back to Catalan
-- (Dyck paths, trees, non-crossing partitions). Each is a RESTRICTION of permutations, re-ranked lex within a size.
--
-- The shared engine: a subsequence (p_i,p_j,p_k) at i<j<k matches pattern (r1,r2,r3) iff its three pairwise
-- comparisons agree with the pattern's. O(n³) existence scan — fine on the (small) floor.
CREATE FUNCTION permutation_avoids_pattern3(p permutation, r1 int, r2 int, r3 int) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j, generate_subscripts((p).image,1) k
    WHERE i < j AND j < k
      AND (((p).image[i] < (p).image[j]) = (r1 < r2))
      AND (((p).image[i] < (p).image[k]) = (r1 < r3))
      AND (((p).image[j] < (p).image[k]) = (r2 < r3))) $$;

CREATE FUNCTION is_avoiding_123(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,1,2,3) $$;
CREATE FUNCTION is_avoiding_132(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,1,3,2) $$;
CREATE FUNCTION is_avoiding_213(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,2,1,3) $$;
CREATE FUNCTION is_avoiding_231(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,2,3,1) $$;
CREATE FUNCTION is_avoiding_312(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,3,1,2) $$;
CREATE FUNCTION is_avoiding_321(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern3(p,3,2,1) $$;

-- accel hook (#172): Knuth's theorem — every Av(σ) for σ∈S₃ is Catalan(n) (count_fn on the parent fiber, shared).
CREATE FUNCTION catalan_of_permutations_fiber(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT catalan_number((f).size::int) $$;

SELECT base_restrict('permutations_avoiding_123','permutations','is_avoiding_123', count_fn => 'catalan_of_permutations_fiber');
SELECT base_restrict('permutations_avoiding_132','permutations','is_avoiding_132', count_fn => 'catalan_of_permutations_fiber');
SELECT base_restrict('permutations_avoiding_213','permutations','is_avoiding_213', count_fn => 'catalan_of_permutations_fiber');
SELECT base_restrict('permutations_avoiding_231','permutations','is_avoiding_231', count_fn => 'catalan_of_permutations_fiber');
SELECT base_restrict('permutations_avoiding_312','permutations','is_avoiding_312', count_fn => 'catalan_of_permutations_fiber');
SELECT base_restrict('permutations_avoiding_321','permutations','is_avoiding_321', count_fn => 'catalan_of_permutations_fiber');

CREATE FUNCTION fiber_symbol(f permutations_avoiding_123_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(123)' $$;
CREATE FUNCTION fiber_symbol(f permutations_avoiding_132_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(132)' $$;
CREATE FUNCTION fiber_symbol(f permutations_avoiding_213_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(213)' $$;
CREATE FUNCTION fiber_symbol(f permutations_avoiding_231_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(231)' $$;
CREATE FUNCTION fiber_symbol(f permutations_avoiding_312_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(312)' $$;
CREATE FUNCTION fiber_symbol(f permutations_avoiding_321_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'S' || to_unicode_subscript((f).size) || '(321)' $$;

SELECT wire_set_notation('permutations_avoiding_123');
SELECT wire_set_notation('permutations_avoiding_132');
SELECT wire_set_notation('permutations_avoiding_213');
SELECT wire_set_notation('permutations_avoiding_231');
SELECT wire_set_notation('permutations_avoiding_312');
SELECT wire_set_notation('permutations_avoiding_321');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('pattern_avoiding_permutations','Knuth: every Av(σ) for σ∈S₃ is Catalan — counts for n=1..5 (all six)','eq','1,2,5,14,42|1,2,5,14,42|1,2,5,14,42|1,2,5,14,42|1,2,5,14,42|1,2,5,14,42','the six length-3 classes are Wilf-equivalent',$q$
    SELECT concat_ws('|',
      (SELECT string_agg(cardinality(permutations_avoiding_123(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n),
      (SELECT string_agg(cardinality(permutations_avoiding_132(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n),
      (SELECT string_agg(cardinality(permutations_avoiding_213(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n),
      (SELECT string_agg(cardinality(permutations_avoiding_231(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n),
      (SELECT string_agg(cardinality(permutations_avoiding_312(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n),
      (SELECT string_agg(cardinality(permutations_avoiding_321(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n)) $q$),
  ('pattern_avoiding_permutations','Av(123) of [3] = every permutation but 123','eq','132,213,231,312,321','the size-3 fiber (only 123 itself avoids nothing — it IS the pattern)',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(permutations_avoiding_123(3)) e $q$),
  ('pattern_avoiding_permutations','Wilf-equivalent but DIFFERENT sets: 123 ∈ Av(321) but 123 ∉ Av(123)','eq','true|false','same count (14 at n=4), different members',$q$
    SELECT (ROW(ARRAY[1,2,3,4])::permutation <@ permutations_avoiding_321(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ permutations_avoiding_123(4))::text $q$),
  ('pattern_avoiding_permutations','stack-sortable = Av(231): set_notation renders in its ambient set','eq','1234 ∈ S₄(231)','the classic stack-sortable class',$q$
    SELECT set_notation(unrank(permutations_avoiding_231(4), 0)) $q$);

-- ── length-4 patterns: vexillary Av(2143) and separable Av(2413,3142) ────────────────────────────────────────
-- The length-4 analogue: six pairwise comparisons of a 4-subsequence must all agree with the pattern's. O(n⁴).
CREATE FUNCTION permutation_avoids_pattern4(p permutation, r1 int, r2 int, r3 int, r4 int) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j,
                  generate_subscripts((p).image,1) k, generate_subscripts((p).image,1) l
    WHERE i < j AND j < k AND k < l
      AND (((p).image[i] < (p).image[j]) = (r1 < r2)) AND (((p).image[i] < (p).image[k]) = (r1 < r3))
      AND (((p).image[i] < (p).image[l]) = (r1 < r4)) AND (((p).image[j] < (p).image[k]) = (r2 < r3))
      AND (((p).image[j] < (p).image[l]) = (r2 < r4)) AND (((p).image[k] < (p).image[l]) = (r3 < r4))) $$;

CREATE FUNCTION is_vexillary(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_avoids_pattern4(p,2,1,4,3) $$;
CREATE FUNCTION is_separable(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT permutation_avoids_pattern4(p,2,4,1,3) AND permutation_avoids_pattern4(p,3,1,4,2) $$;

-- accel hook (#172): separable = Av(2413,3142) is counted by the large Schröder numbers (A006318) — the same
-- closed form schroeder_numbers.sql already carries, borrowed here rather than redefined. vexillary_permutations
-- (A005802) has NO known simple closed form (only a sum over standard-tableaux hook-length products) — see
-- traits.sql's no_closed_form_count tag.
CREATE FUNCTION separable_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).size::int = 0 THEN 1::numeric ELSE schroeder_large_number(((f).size::int - 1)::term_index) END $$;   -- |Sep(n)| = R(n-1), n≥1

SELECT base_restrict('vexillary_permutations','permutations','is_vexillary');
SELECT base_restrict('separable_permutations','permutations','is_separable', count_fn => 'separable_permutation_count');

CREATE FUNCTION fiber_symbol(f vexillary_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Vex(' || (f).size::int || ')' $$;
CREATE FUNCTION fiber_symbol(f separable_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Sep(' || (f).size::int || ')' $$;
SELECT wire_set_notation('vexillary_permutations');
SELECT wire_set_notation('separable_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('pattern_avoiding_permutations','vexillary = Av(2143): count A005802 for n=1..6','eq','1,2,6,23,103,513','single length-4 pattern',$q$
    SELECT string_agg(cardinality(vexillary_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('pattern_avoiding_permutations','separable = Av(2413,3142): the large Schröder numbers A006318 for n=1..6','eq','1,2,6,22,90,394','two length-4 patterns; ties permutations to Schröder paths',$q$
    SELECT string_agg(cardinality(separable_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('pattern_avoiding_permutations','2143 ∉ vexillary (it IS the pattern), 1234 ∈','eq','false|true','the defining avoidance',$q$
    SELECT (ROW(ARRAY[2,1,4,3])::permutation <@ vexillary_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ vexillary_permutations(4))::text $q$);

-- per-collection living examples (suite = the collection id, so base_example_link tags each row's collection) ──
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('permutations_avoiding_123','Catalan count 14 at n=4; 123 itself excluded, 321 belongs','eq','14|false|true','Av(123)',$q$
    SELECT cardinality(permutations_avoiding_123(4))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_123(3))::text || '|' ||
           (ROW(ARRAY[3,2,1])::permutation <@ permutations_avoiding_123(3))::text $q$),
  ('permutations_avoiding_132','Catalan count 14 at n=4; 132 excluded, 123 belongs','eq','14|false|true','Av(132)',$q$
    SELECT cardinality(permutations_avoiding_132(4))::text || '|' ||
           (ROW(ARRAY[1,3,2])::permutation <@ permutations_avoiding_132(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_132(3))::text $q$),
  ('permutations_avoiding_213','Catalan count 14 at n=4; 213 excluded, 123 belongs','eq','14|false|true','Av(213)',$q$
    SELECT cardinality(permutations_avoiding_213(4))::text || '|' ||
           (ROW(ARRAY[2,1,3])::permutation <@ permutations_avoiding_213(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_213(3))::text $q$),
  ('permutations_avoiding_231','Catalan count 14 at n=4 (stack-sortable); 231 excluded, 123 belongs','eq','14|false|true','Av(231)',$q$
    SELECT cardinality(permutations_avoiding_231(4))::text || '|' ||
           (ROW(ARRAY[2,3,1])::permutation <@ permutations_avoiding_231(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_231(3))::text $q$),
  ('permutations_avoiding_312','Catalan count 14 at n=4; 312 excluded, 123 belongs','eq','14|false|true','Av(312)',$q$
    SELECT cardinality(permutations_avoiding_312(4))::text || '|' ||
           (ROW(ARRAY[3,1,2])::permutation <@ permutations_avoiding_312(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_312(3))::text $q$),
  ('permutations_avoiding_321','Catalan count 14 at n=4; 321 excluded, 123 belongs','eq','14|false|true','Av(321)',$q$
    SELECT cardinality(permutations_avoiding_321(4))::text || '|' ||
           (ROW(ARRAY[3,2,1])::permutation <@ permutations_avoiding_321(3))::text || '|' ||
           (ROW(ARRAY[1,2,3])::permutation <@ permutations_avoiding_321(3))::text $q$),
  ('separable_permutations','large Schröder count 22 at n=4; 2413 excluded, 1234 belongs','eq','22|false|true','Av(2413,3142); A006318',$q$
    SELECT cardinality(separable_permutations(4))::text || '|' ||
           (ROW(ARRAY[2,4,1,3])::permutation <@ separable_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ separable_permutations(4))::text $q$),
  ('vexillary_permutations','count 23 at n=4; 2143 excluded, 1234 belongs','eq','23|false|true','Av(2143); A005802',$q$
    SELECT cardinality(vexillary_permutations(4))::text || '|' ||
           (ROW(ARRAY[2,1,4,3])::permutation <@ vexillary_permutations(4))::text || '|' ||
           (ROW(ARRAY[1,2,3,4])::permutation <@ vexillary_permutations(4))::text $q$),
  ('pattern_avoiding_permutations','accel hooks (#172): all six Av(σ) + separable carry their own fiber_count; vexillary does not (no known closed form)','eq','true|false','base_restrict wired the closed forms',$q$
    SELECT bool_and(to_regprocedure('fiber_count(' || c || '_fiber)') IS NOT NULL)::text || '|' ||
           (to_regprocedure('fiber_count(vexillary_permutations_fiber)') IS NOT NULL)::text
    FROM unnest(ARRAY['permutations_avoiding_123','permutations_avoiding_132','permutations_avoiding_213',
                       'permutations_avoiding_231','permutations_avoiding_312','permutations_avoiding_321',
                       'separable_permutations']) c $q$);
