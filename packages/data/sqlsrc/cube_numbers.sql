-- requires: realizer
-- cube_numbers — n^3: 0,1,8,27,64,… Ungraded/∞ numeric.
CREATE TYPE cube_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f cube_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT r::numeric*r*r FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f cube_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::numeric*rank*rank $fu$;
INSERT INTO base_collection VALUES ('cube_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('cube_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('cube_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('cube_numbers','first terms','eq','0,1,8,27,64,125,216,343,512','n^3',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(cube_numbers(),9) e $q$),
  ('cube_numbers','synthesized monotonic contains via <@: 27 ∈, 26 ∉','eq','true|false','scan the non-decreasing floor until the term meets/passes v',$q$ SELECT (27::numeric<@cube_numbers())::text||'|'||(26::numeric<@cube_numbers())::text $q$);
