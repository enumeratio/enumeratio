-- requires: polygonal_numbers, realizer
-- heptagonal_numbers — n(5n-3)/2: 0,1,7,18,34,… Ungraded/∞ numeric (div for exact /2).
CREATE TYPE heptagonal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f heptagonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT div(r::numeric*(5*r-3),2) FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f heptagonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT div(rank::numeric*(5*rank-3),2) $fu$;
INSERT INTO base_collection VALUES ('heptagonal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('heptagonal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('heptagonal_numbers');
INSERT INTO base_family_point (collection, family, bindings) VALUES ('heptagonal_numbers','polygonal_numbers','{"k": 7}');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('heptagonal_numbers','first terms','eq','0,1,7,18,34,55,81,112,148','n(5n-3)/2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(heptagonal_numbers(),9) e $q$),
  ('heptagonal_numbers','unrank(9) = 189 = 9·(5·9-3)/2','eq','189','off the floor',$q$ SELECT (unrank(heptagonal_numbers(), 9)).value::text $q$),
  ('heptagonal_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$ SELECT cardinality(heptagonal_numbers())::text $q$),
  ('heptagonal_numbers','contains via synthesized scan: 148 ∈, 149 ∉','eq','true|false','monotonic-sequence contains + <@',$q$ SELECT (148::numeric <@ heptagonal_numbers())::text || '|' || (149::numeric <@ heptagonal_numbers())::text $q$),
  ('heptagonal_numbers','common-difference identity: H(n)-H(n-1) = 5n-4 for n=1..8','eq','true','k-gonal recurrence, k=7',$q$
    SELECT bool_and((unrank(heptagonal_numbers(), n)).value - (unrank(heptagonal_numbers(), n-1)).value = 5*n-4)::text FROM generate_series(1,8) n $q$);
