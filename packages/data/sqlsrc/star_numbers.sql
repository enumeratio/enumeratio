-- requires: realizer
-- star_numbers — 6n(n+1)+1: 1,13,37,73,121,… (centered 12-gonal). Ungraded/∞ numeric.
CREATE TYPE star_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f star_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT 6*r::numeric*(r+1)+1 FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f star_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT 6*rank::numeric*(rank+1)+1 $fu$;
INSERT INTO base_collection VALUES ('star_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('star_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('star_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('star_numbers','first terms','eq','1,13,37,73,121,181,253,337,433','6n(n+1)+1',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(star_numbers(),9) e $q$);
