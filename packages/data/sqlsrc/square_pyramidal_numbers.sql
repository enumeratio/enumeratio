-- requires: realizer
-- square_pyramidal_numbers — n(n+1)(2n+1)/6: 0,1,5,14,30,55,… Ungraded/∞ numeric (div for exact /6).
CREATE TYPE square_pyramidal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f square_pyramidal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT div(r::numeric*(r+1)*(2*r+1),6) FROM generate_series(0,element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f square_pyramidal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT div(rank::numeric*(rank+1)*(2*rank+1),6) $fu$;
INSERT INTO base_collection VALUES ('square_pyramidal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('square_pyramidal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('square_pyramidal_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('square_pyramidal_numbers','first terms','eq','0,1,5,14,30,55,91,140,204','n(n+1)(2n+1)/6',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(square_pyramidal_numbers(),9) e $q$),
  ('square_pyramidal_numbers','unrank(9) = 285 = 9·10·19/6','eq','285','off the floor',$q$ SELECT (unrank(square_pyramidal_numbers(), 9)).value::text $q$),
  ('square_pyramidal_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$ SELECT cardinality(square_pyramidal_numbers())::text $q$),
  ('square_pyramidal_numbers','contains via synthesized scan: 204 ∈, 205 ∉','eq','true|false','monotonic-sequence contains + <@',$q$ SELECT (204::numeric <@ square_pyramidal_numbers())::text || '|' || (205::numeric <@ square_pyramidal_numbers())::text $q$),
  ('square_pyramidal_numbers','sum-of-squares identity: SP(n)-SP(n-1) = n² for n=1..8','eq','true','square pyramid = running sum of squares',$q$
    SELECT bool_and((unrank(square_pyramidal_numbers(), n)).value - (unrank(square_pyramidal_numbers(), n-1)).value = n*n)::text FROM generate_series(1,8) n $q$);
