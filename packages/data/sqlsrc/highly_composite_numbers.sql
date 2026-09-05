-- requires: realizer
-- highly_composite_numbers — n with more divisors than any smaller positive integer, τ(n) > τ(m) ∀ 0<m<n (A002182):
-- 1,2,4,6,12,24,36,48,60,120,180,240,360,720,840,… Ramanujan (1915): the counterpart to primes. Membership is a
-- record-property over ALL smaller n (no local predicate), so the floor is a literal seed of the window through 45360
-- and contains is membership in it. Unbounded ⇒ ∞. (The divisor count τ is exposed via number_of_divisors below.)

CREATE FUNCTION number_of_divisors(n numeric) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_series(1, greatest(trunc(n)::bigint, 1)) d WHERE mod(n, d) = 0 $$;

CREATE FUNCTION highly_composite_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[1,2,4,6,12,24,36,48,60,120,180,240,360,720,840,1260,1680,2520,5040,7560,10080,15120,20160,
    25200,27720,45360]::numeric[] $$;

CREATE TYPE highly_composite_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f highly_composite_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(highly_composite_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f highly_composite_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(highly_composite_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('highly_composite_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f highly_composite_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'HCN' $$;   -- corpus symbol
SELECT base_realize('highly_composite_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('highly_composite_numbers','first ten via the realized floor','eq','1,2,4,6,12,24,36,48,60,120','A002182',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(highly_composite_numbers(), 10) e $q$),
  ('highly_composite_numbers','divisor counts τ are strictly increasing along the sequence','ok',NULL,'the defining record property',$q$
    SELECT bool_and(number_of_divisors(v) > number_of_divisors(prev)) FROM (
      SELECT v, lag(v) OVER (ORDER BY o) prev FROM unnest(highly_composite_numbers_seed()) WITH ORDINALITY AS t(v, o)) s
      WHERE prev IS NOT NULL $q$),
  ('highly_composite_numbers','contains via <@: 12 ∈ (τ=6), 96 ∉ (τ=12 but 60 already reached 12)','eq','true|false','record-property membership',$q$
    SELECT (12::numeric <@ highly_composite_numbers())::text || '|' || (96::numeric <@ highly_composite_numbers())::text $q$),
  ('highly_composite_numbers','τ(360)=24 is a record; τ(720)=30 the next','eq','24|30','divisor-count records',$q$
    SELECT number_of_divisors(360)::text || '|' || number_of_divisors(720)::text $q$);
