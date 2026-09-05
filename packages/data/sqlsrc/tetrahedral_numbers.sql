-- requires: realizer
-- tetrahedral_numbers — Te(n)=n(n+1)(n+2)/6: 0,1,4,10,20,… Ungraded/∞ numeric (div for exact /6).
CREATE TYPE tetrahedral_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f tetrahedral_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT div(r::numeric*(r+1)*(r+2), 6) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f tetrahedral_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- Te(n)=v, n ≈ ∛(6v)
  SELECT v >= 0 AND v = trunc(v) AND EXISTS (
    SELECT 1 FROM generate_series(0, ceil((6*v + 1) ^ (1.0/3.0))::int + 2) n WHERE div(n::numeric*(n+1)*(n+2), 6) = v) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f tetrahedral_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT div(rank::numeric*(rank+1)*(rank+2), 6) $fu$;
INSERT INTO base_collection VALUES ('tetrahedral_numbers','numeric',true);
SELECT base_realize('tetrahedral_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('tetrahedral_numbers','first terms','eq','0,1,4,10,20,35,56,84,120','n(n+1)(n+2)/6',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(tetrahedral_numbers(),9) e $q$),
  ('tetrahedral_numbers','contains via <@: 20 ∈ (Te(4)), 21 ∉','eq','true|false','bounded-search membership',$q$ SELECT (20::numeric <@ tetrahedral_numbers())::text || '|' || (21::numeric <@ tetrahedral_numbers())::text $q$);
