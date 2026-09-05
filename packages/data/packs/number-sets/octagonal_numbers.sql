-- requires: realizer
-- octagonal_numbers — n(3n-2): 0,1,8,21,40,… Ungraded/∞ numeric.
CREATE TYPE octagonal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f octagonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT r::numeric*(3*r-2) FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f octagonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::numeric*(3*rank-2) $fu$;
INSERT INTO base_collection VALUES ('octagonal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('octagonal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('octagonal_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('octagonal_numbers','first terms','eq','0,1,8,21,40,65,96,133,176','n(3n-2)',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(octagonal_numbers(),9) e $q$),
  ('octagonal_numbers','unrank(9) = 225 = 9·(3·9-2)','eq','225','off the floor',$q$ SELECT (unrank(octagonal_numbers(), 9)).value::text $q$),
  ('octagonal_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$ SELECT cardinality(octagonal_numbers())::text $q$),
  ('octagonal_numbers','contains via synthesized scan: 176 ∈, 177 ∉','eq','true|false','monotonic-sequence contains + <@',$q$ SELECT (176::numeric <@ octagonal_numbers())::text || '|' || (177::numeric <@ octagonal_numbers())::text $q$),
  ('octagonal_numbers','common-difference identity: O(n)-O(n-1) = 6n-5 for n=1..8','eq','true','k-gonal recurrence, k=8',$q$
    SELECT bool_and((unrank(octagonal_numbers(), n)).value - (unrank(octagonal_numbers(), n-1)).value = 6*n-5)::text FROM generate_series(1,8) n $q$);
