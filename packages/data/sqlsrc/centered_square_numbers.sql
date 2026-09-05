-- requires: realizer
-- centered_square_numbers — 2n(n+1)+1: 1,5,13,25,41,… Ungraded/∞ numeric.
CREATE TYPE centered_square_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f centered_square_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT 2*r::numeric*(r+1)+1 FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f centered_square_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT 2*rank::numeric*(rank+1)+1 $fu$;
INSERT INTO base_collection VALUES ('centered_square_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('centered_square_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('centered_square_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('centered_square_numbers','first terms','eq','1,5,13,25,41,61,85,113,145','2n(n+1)+1',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(centered_square_numbers(),9) e $q$);
