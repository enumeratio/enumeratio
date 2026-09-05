-- requires: permutations, standard_tableaux, realizer, utilities
-- Restrictions as DERIVED collections via base_restrict(coll, parent, predicate): the derived collection reuses
-- the parent's carrier + grade chain, its floor filters the parent's floor (realizer re-ranks), and contains =
-- parent-contains AND predicate. Data-driven — a restriction is now three words, not a hand-written surface.

CREATE FUNCTION is_derangement(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((p).image,1) i WHERE (p).image[i] = i) $$;
CREATE FUNCTION is_involution(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM generate_subscripts((p).image,1) i WHERE (p).image[(p).image[i]] <> i) $$;
CREATE FUNCTION is_even_permutation(p permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT mod((SELECT count(*) FROM generate_subscripts((p).image,1) i, generate_subscripts((p).image,1) j
              WHERE i < j AND (p).image[i] > (p).image[j])::int, 2) = 0 $$;

-- accel hooks (#89 / #172): the subfactorial !n (derangements), the telephone numbers T(n) (involutions — same
-- recurrence standard_tableaux.sql already uses, borrowed here rather than redefined), and n!/2 for n≥2 (even
-- permutations; n=0,1 are the trivial group of size 1, not 0!/2). count_fn is on the PARENT (permutations_fiber).
CREATE FUNCTION subfactorial(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- !n = (n−1)(!(n−1)+!(n−2)), !0=1, !1=0
  DECLARE a numeric := 1; b numeric := 0; t numeric; i int; BEGIN
    IF n = 0 THEN RETURN 1; END IF;
    IF n = 1 THEN RETURN 0; END IF;
    FOR i IN 2..n LOOP t := (i - 1) * (a + b); a := b; b := t; END LOOP;
    RETURN b;
  END $$;
CREATE FUNCTION derangement_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT subfactorial((f).size::int) $$;
CREATE FUNCTION involution_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT telephone_number((f).size::int) $$;
CREATE FUNCTION even_permutation_count(f permutations_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).size::int < 2 THEN 1::numeric ELSE div(factorial((f).size::int), 2) END $$;

SELECT base_restrict('derangements',      'permutations', 'is_derangement',      count_fn => 'derangement_count');

CREATE FUNCTION fiber_symbol(f derangements_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'D(' || (f).size::int || ')' $$;   -- corpus symbol

SELECT wire_set_notation('derangements');
SELECT base_restrict('involutions',       'permutations', 'is_involution',       count_fn => 'involution_count');
CREATE FUNCTION fiber_symbol(f involutions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Inv(' || (f).size::int || ')' $$;   -- corpus symbol
SELECT wire_set_notation('involutions');
SELECT base_restrict('even_permutations', 'permutations', 'is_even_permutation', count_fn => 'even_permutation_count');
CREATE FUNCTION fiber_symbol(f even_permutations_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'A' || to_unicode_subscript((f).size) $$;   -- corpus symbol
SELECT wire_set_notation('even_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('restrictions','accel hooks (#172) are HONORED: all three restrictions carry their own fiber_count','eq','true|true|true','base_restrict wired the closed forms, not a floor scan',$q$
    SELECT (to_regprocedure('fiber_count(derangements_fiber)') IS NOT NULL)::text || '|' ||
           (to_regprocedure('fiber_count(involutions_fiber)') IS NOT NULL)::text || '|' ||
           (to_regprocedure('fiber_count(even_permutations_fiber)') IS NOT NULL)::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  -- the base_restrict MACHINERY (cross-cutting): a restriction filters the parent floor and RE-RANKS it from 0
  ('restrictions','a restriction re-ranks its parent: derangements(4) has contiguous ordinals 0..8','eq','true','the 9 survivors are re-ranked, not left at their parent ranks',$q$
    SELECT (array_agg(ordinality(e)::int ORDER BY ordinality(e)) = ARRAY(SELECT generate_series(0,8)))::text FROM elements(derangements(4)) e $q$),

  -- derangements — permutations with no fixed point (subfactorial !n)
  ('derangements','anchor: |derangements(n)| for n=0..5 is 1,0,1,2,9,44','eq','1,0,1,2,9,44','the subfactorial !n',$q$
    SELECT string_agg(cardinality(derangements(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('derangements','derangements(4) enumerated','eq','2143,2341,2413,3142,3412,3421,4123,4312,4321','the filtered floor, in lex order',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(derangements(4)) e $q$),
  ('derangements','contains via <@: 2143 ∈ derangements(4), 1234 ∉ (it fixes every point)','eq','true|false','derived membership = parent ∧ no fixed point',$q$
    SELECT (ROW(ARRAY[2,1,4,3])::permutation <@ derangements(4))::text || '|' || (ROW(ARRAY[1,2,3,4])::permutation <@ derangements(4))::text $q$),

  -- involutions — self-inverse permutations (telephone / involution numbers)
  ('involutions','anchor: |involutions(n)| for n=0..5 is 1,1,2,4,10,26','eq','1,1,2,4,10,26','the telephone numbers T(n)',$q$
    SELECT string_agg(cardinality(involutions(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('involutions','involutions(3) enumerated = 123,132,213,321','eq','123,132,213,321','the identity plus the three transpositions',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(involutions(3)) e $q$),
  ('involutions','the defining property: every involution is its own inverse (132 = 132⁻¹)','eq','true','σ = σ⁻¹',$q$
    SELECT (perm_inverse(ROW(ARRAY[1,3,2])::permutation) = ROW(ARRAY[1,3,2])::permutation)::text $q$),

  -- even_permutations — the alternating group A_n (an even number of inversions; n!/2 for n≥2)
  ('even_permutations','anchor: |even_permutations(n)| for n=0..5 is 1,1,1,3,12,60','eq','1,1,1,3,12,60','|A_n| = n!/2 for n≥2',$q$
    SELECT string_agg(cardinality(even_permutations(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('even_permutations','even_permutations(3) enumerated = A_3','eq','123,231,312','the identity and the two 3-cycles',$q$
    SELECT string_agg(one_line((e).value), ',' ORDER BY ordinality(e)) FROM elements(even_permutations(3)) e $q$);
