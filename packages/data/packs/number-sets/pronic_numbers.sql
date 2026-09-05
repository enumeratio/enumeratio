-- requires: fibonacci, triangular_numbers, realizer
-- pronic_numbers (oblong) — P(n)=n(n+1): 0,2,6,12,20,… Ungraded/∞ numeric. contains: n pronic iff 4n+1 is a square.
CREATE TYPE pronic_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f pronic_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT r::numeric*(r+1) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f pronic_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_perfect_square(4*v+1) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f pronic_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT rank::numeric*(rank+1) $fu$;
INSERT INTO base_collection VALUES ('pronic_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f pronic_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Pro' $$;   -- corpus symbol
SELECT base_realize('pronic_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('pronic_numbers','first terms','eq','0,2,6,12,20,30,42,56,72','n(n+1)',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(pronic_numbers(),9) e $q$),
  ('pronic_numbers','contains: 30 ∈, 31 ∉','eq','true|false','4n+1 square',$q$ SELECT (30::numeric <@ pronic_numbers())::text||'|'||(31::numeric <@ pronic_numbers())::text $q$),
  ('pronic_numbers','P(n) = 2·T(n) for n=0..8 (pronic is twice triangular)','eq','true','cross-check against the triangular_numbers floor',$q$
    SELECT bool_and((unrank(pronic_numbers(), n)).value = 2*(unrank(triangular_numbers(), n)).value)
    FROM generate_series(0, 8) n $q$),
  ('pronic_numbers','unrank(10) = 110 = 10·11','eq','110','off the floor',$q$
    SELECT (unrank(pronic_numbers(), 10)).value::text $q$),
  ('pronic_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(pronic_numbers())::text $q$);
