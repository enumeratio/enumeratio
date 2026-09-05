-- requires: permutations, realizer, utilities
-- lehmer_codes — a SECOND carrier for permutations, ORDER-ISOMORPHIC to `permutations`. The inversion/Lehmer
-- structure (trailing 0 omitted in the data, present in the serialization). Its floor maps permutations' floor
-- through the bijection to_inversion, so lehmer_codes(n) and permutations(n) share cardinality AND rank: the
-- r-th lehmer code corresponds (via to_permutation) to the r-th permutation. Demonstrates order-isos in base.

CREATE TYPE permutation_inversion AS (code int[]);                     -- L[1..n-1]; L[n]=0 is implied
CREATE FUNCTION lehmer_code(v permutation_inversion) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT array_to_string((v).code || 0, '') $$;  -- serialization includes the trailing 0
CREATE FUNCTION notation(v permutation_inversion) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lehmer_code(v) $$;   -- canonical serialization for render()

-- the bijection permutation <-> permutation_inversion (order-iso under lex)
CREATE FUNCTION to_inversion(p permutation) RETURNS permutation_inversion LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE pts int[] := (p).image; n int := coalesce(array_length((p).image,1), 0); code int[] := '{}'; i int; c int; j int;
  BEGIN
    FOR i IN 1..n-1 LOOP                                               -- L[i] = #{ j>i : pts[j] < pts[i] }; skip L[n]=0
      c := 0; FOR j IN i+1..n LOOP IF pts[j] < pts[i] THEN c := c + 1; END IF; END LOOP;
      code := code || c;
    END LOOP;
    RETURN ROW(code)::permutation_inversion;
  END $$;
CREATE FUNCTION to_permutation(v permutation_inversion) RETURNS permutation LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE L int[] := (v).code || 0; n int := coalesce(array_length((v).code,1), 0) + 1; avail int[] := ARRAY(SELECT generate_series(1,n));
          pts int[] := '{}'; i int; idx int;
  BEGIN
    FOR i IN 1..n LOOP idx := L[i]; pts := pts || avail[idx+1]; avail := avail[1:idx] || avail[idx+2:array_length(avail,1)]; END LOOP;
    RETURN ROW(pts)::permutation;
  END $$;

-- engines: the floor maps permutations' floor through to_inversion ⇒ same order ⇒ order-iso by construction
CREATE TYPE lehmer_codes_fiber AS (size natural_number);   -- typed fiber; axis: size
CREATE FUNCTION fiber_elements(f lehmer_codes_fiber, element_limit int) RETURNS SETOF permutation_inversion LANGUAGE sql STABLE AS $$
  SELECT to_inversion(permutation_unrank_lex((f).size::int, ord)) FROM generate_series(0, (factorial((f).size::int) - 1)::int) ord LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f lehmer_codes_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT factorial((f).size::int) $$;
CREATE FUNCTION contains_in_fiber(f lehmer_codes_fiber, v permutation_inversion) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- valid code: length n-1, code[i] ∈ [0, n-i]
  SELECT coalesce(array_length((v).code,1),0) = (f).size::int - 1
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).code,1) i WHERE (v).code[i] < 0 OR (v).code[i] > (f).size::int - i) $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f lehmer_codes_fiber, rank rank_index) RETURNS permutation_inversion LANGUAGE sql IMMUTABLE AS $fu$ SELECT to_inversion(permutation_unrank_lex((f).size::int, rank)) $fu$;
INSERT INTO base_collection VALUES ('lehmer_codes', 'permutation_inversion');
INSERT INTO base_grade VALUES ('lehmer_codes', 1, 'size', NULL, NULL);
SELECT base_realize('lehmer_codes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lehmer_codes','lehmer_codes(3) serialized (order matches permutations)','eq','000,010,100,110,200,210','to_inversion of 123,132,213,231,312,321',$q$
    SELECT string_agg(lehmer_code((e).value), ',' ORDER BY ordinality(e)) FROM elements(lehmer_codes(3)) e $q$),
  ('lehmer_codes','same cardinality as permutations: |lehmer_codes(4)| = 24','eq','24','order-iso ⇒ same size',$q$
    SELECT cardinality(lehmer_codes(4))::text $q$),
  ('lehmer_codes','ORDER-ISO: to_permutation(r-th lehmer code) = r-th permutation, all r < 24','ok',NULL,'ranks correspond across the two carriers',$q$
    DO $$ DECLARE r int; BEGIN
      FOR r IN 0..23 LOOP
        ASSERT to_permutation((unrank(lehmer_codes(4), r)).value) = (unrank(permutations(4), r)).value, 'iso broke at rank '||r;
      END LOOP; END $$ $q$),
  ('lehmer_codes','structure omits the trailing 0; serialization includes it','eq','{2,1}|210','321 ↦ code {2,1}, lehmer 210',$q$
    SELECT (to_inversion(ROW(ARRAY[3,2,1])::permutation)).code::text || '|' || lehmer_code(to_inversion(ROW(ARRAY[3,2,1])::permutation)) $q$),
  ('lehmer_codes','contains via <@: a valid size-3 code ∈','eq','true','[2,0] is a valid Lehmer code of size 3',$q$
    SELECT (ROW(ARRAY[2,0])::permutation_inversion <@ lehmer_codes(3))::text $q$);
