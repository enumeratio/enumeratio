-- requires: realizer
-- hexagonal_numbers — H(n)=n(2n-1): 0,1,6,15,28,… Ungraded/∞ numeric.
CREATE TYPE hexagonal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f hexagonal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT r::numeric*(2*r-1) FROM generate_series(0, element_limit-1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f hexagonal_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::numeric*(2*rank-1) $fu$;
INSERT INTO base_collection VALUES ('hexagonal_numbers','numeric',true);
INSERT INTO base_monotonic_sequence VALUES ('hexagonal_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('hexagonal_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('hexagonal_numbers','first terms','eq','0,1,6,15,28,45,66,91,120','n(2n-1)',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(hexagonal_numbers(),9) e $q$),
  ('hexagonal_numbers','unrank(10)=190','eq','190','H(10)',$q$ SELECT (unrank(hexagonal_numbers(),10)).value::text $q$);
