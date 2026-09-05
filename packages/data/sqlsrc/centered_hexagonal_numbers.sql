-- requires: realizer
-- centered_hexagonal_numbers — 3n(n+1)+1: 1,7,19,37,61,… (hex/crystal numbers). Ungraded/∞ numeric.
CREATE TYPE centered_hexagonal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f centered_hexagonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT 3*r::numeric*(r+1)+1 FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f centered_hexagonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT 3*rank::numeric*(rank+1)+1 $fu$;
INSERT INTO base_collection VALUES ('centered_hexagonal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('centered_hexagonal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('centered_hexagonal_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('centered_hexagonal_numbers','first terms','eq','1,7,19,37,61,91,127,169,217','3n(n+1)+1',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(centered_hexagonal_numbers(),9) e $q$);
