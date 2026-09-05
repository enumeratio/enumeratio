-- requires: realizer
-- pentatope_numbers — 4-simplex: n(n+1)(n+2)(n+3)/24: 0,1,5,15,35,70,… Ungraded/∞ numeric (div for exact /24).
CREATE TYPE pentatope_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f pentatope_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT div(r::numeric*(r+1)*(r+2)*(r+3),24) FROM generate_series(0,element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f pentatope_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- P(n)=v, n ≈ ⁴√(24v)
  SELECT v >= 0 AND v = trunc(v) AND EXISTS (
    SELECT 1 FROM generate_series(0, ceil((24*v + 1) ^ (1.0/4.0))::int + 2) n WHERE div(n::numeric*(n+1)*(n+2)*(n+3), 24) = v) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f pentatope_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT div(rank::numeric*(rank+1)*(rank+2)*(rank+3),24) $fu$;
INSERT INTO base_collection VALUES ('pentatope_numbers','numeric',true);
SELECT base_realize('pentatope_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('pentatope_numbers','first terms','eq','0,1,5,15,35,70,126,210,330','n(n+1)(n+2)(n+3)/24',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(pentatope_numbers(),9) e $q$),
  ('pentatope_numbers','contains via <@: 70 ∈ (P(5)), 71 ∉','eq','true|false','bounded-search membership',$q$ SELECT (70::numeric <@ pentatope_numbers())::text || '|' || (71::numeric <@ pentatope_numbers())::text $q$);
