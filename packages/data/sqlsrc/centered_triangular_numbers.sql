-- requires: realizer
-- centered_triangular_numbers — (3n(n+1)+2)/2: 1,4,10,19,31,… Ungraded/∞ numeric (div for exact /2).
CREATE TYPE centered_triangular_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f centered_triangular_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT div(3*r::numeric*(r+1)+2,2) FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f centered_triangular_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT div(3*rank::numeric*(rank+1)+2,2) $fu$;
INSERT INTO base_collection VALUES ('centered_triangular_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('centered_triangular_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('centered_triangular_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('centered_triangular_numbers','first terms','eq','1,4,10,19,31,46,64,85,109','(3n(n+1)+2)/2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(centered_triangular_numbers(),9) e $q$);
