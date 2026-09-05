-- requires: dyck_paths, parking_functions, realizer
-- ported from old-backup non-decreasing-parking-functions.sql
-- non_decreasing_parking_functions — base_restrict of parking_functions: the parking functions whose spots
-- array is already non-decreasing, i.e. a_1 <= a_2 <= ... <= a_n with a_i <= i (the sequence equals its own
-- sorted rearrangement, so the ordinary parking condition collapses to this direct one). |NDPF(n)| = Catalan(n)
-- — the classical bijective face of the Catalan numbers. The old version borrowed the dyck_path carrier and a
-- transported lex order; here it's a plain restriction of parking_functions, reusing that carrier + notation
-- outright (same objects, simpler expression under the new model). Wires a fiber_count accel via base_restrict's
-- count_fn hook (#89), reusing dyck_paths' catalan() identity (#284) instead of falling through to the
-- filter-the-parent-floor count.

-- ── predicate + restriction ──────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_non_decreasing_parking_function(v parking_function) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM generate_subscripts((v).spots, 1) i
    WHERE i < array_length((v).spots, 1) AND (v).spots[i] > (v).spots[i + 1]
  )
$$;

-- count_fn is on the PARENT fiber (parking_functions_fiber), per base_restrict's #89 accel-hook convention.
CREATE FUNCTION non_decreasing_parking_functions_count(f parking_functions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT catalan((f).n::int) $$;

SELECT base_restrict('non_decreasing_parking_functions', 'parking_functions', 'is_non_decreasing_parking_function',
                      count_fn => 'non_decreasing_parking_functions_count');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_decreasing_parking_functions','|NDPF(4)| = 14 (Catalan(4), accel)','eq','14','base_restrict wires catalan(n) as the count_fn',$q$
    SELECT cardinality(non_decreasing_parking_functions(4))::text $q$),

  ('non_decreasing_parking_functions','|NDPF(6)| = 132 (Catalan(6))','eq','132','',$q$
    SELECT cardinality(non_decreasing_parking_functions(6))::text $q$),

  ('non_decreasing_parking_functions','|NDPF(12)| = 208012 (Catalan(12), accel only — the parent parking_functions(12) floor is 13^11 ≈ 1.8e12 candidates)','eq','208012','closed form via count_fn, not the filtered parent floor',$q$
    SELECT cardinality(non_decreasing_parking_functions(12))::text $q$),

  ('non_decreasing_parking_functions','Catalan A000108 anchor for n=0..6','eq','1,1,2,5,14,42,132','1,1,2,5,14,42,132',$q$
    SELECT string_agg(cardinality(non_decreasing_parking_functions(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),

  ('non_decreasing_parking_functions','length-3 sequences in order','eq','1,1,1|1,1,2|1,1,3|1,2,2|1,2,3','the 5 non-decreasing parking functions of length 3',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(non_decreasing_parking_functions(3)) e $q$),

  ('non_decreasing_parking_functions','every element of the n=4 fiber is non-decreasing with a_i <= i','eq','true','structural invariant, checked over the whole fiber',$q$
    SELECT bool_and(
        NOT EXISTS (SELECT 1 FROM generate_subscripts(((e).value).spots,1) i
                    WHERE i < array_length(((e).value).spots,1) AND ((e).value).spots[i] > ((e).value).spots[i+1])
        AND NOT EXISTS (SELECT 1 FROM generate_subscripts(((e).value).spots,1) i WHERE ((e).value).spots[i] > i)
      )::text
    FROM elements(non_decreasing_parking_functions(4)) e $q$),

  ('non_decreasing_parking_functions','contains via <@: {1,1,2} in NDPF(3), {1,2,1} not (valid parking fn, but not sorted)','eq','true|false','derived membership = parent ∧ predicate',$q$
    SELECT (ROW(ARRAY[1,1,2])::parking_function <@ non_decreasing_parking_functions(3))::text || '|' ||
           (ROW(ARRAY[1,2,1])::parking_function <@ non_decreasing_parking_functions(3))::text $q$),

  ('thesis','|non_decreasing_parking_functions(n)| IS Catalan(n)','ok',NULL,'another face of the Catalan number, in bijection with the Dyck paths.',$q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 0..7 LOOP ASSERT cardinality(non_decreasing_parking_functions(n)) = catalan(n), 'cat @' || n; END LOOP;
    END $$
  $q$);
