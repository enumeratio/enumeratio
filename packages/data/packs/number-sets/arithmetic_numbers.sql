-- requires: realizer
-- arithmetic_numbers — positive integers n where the average of the divisors of n is an integer, i.e.
-- sigma(n) (sum of divisors) is divisible by d(n) (number of divisors) (A003601): 1,3,5,6,7,11,13,14,15,19,20,...
-- (2,4,8,9,10,... excluded — e.g. n=2: divisors 1,2, sum 3, count 2, 3/2 not integer). Number set.
CREATE FUNCTION is_arithmetic(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n >= 1 AND mod(sum(i), count(i)) = 0
  FROM generate_series(1, n::bigint) i WHERE mod(n, i::numeric) = 0
$$;
CREATE TYPE arithmetic_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f arithmetic_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit*4+30) n WHERE is_arithmetic(n::numeric) LIMIT element_limit
$$;
CREATE FUNCTION contains_in_fiber(f arithmetic_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_arithmetic(v)
$$;
INSERT INTO base_collection VALUES ('arithmetic_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f arithmetic_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Ore' $$;   -- corpus symbol
SELECT base_realize('arithmetic_numbers');

INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('arithmetic_numbers','first nine','eq','1,3,5,6,7,11,13,14,15','sigma(n) % d(n) = 0',
    $q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(arithmetic_numbers(),9) e $q$),
  ('arithmetic_numbers','6 in: divisors 1,2,3,6 sum 12 count 4, 12/4=3','eq','true','',
    $q$ SELECT is_arithmetic(6) $q$),
  ('arithmetic_numbers','2 out: divisors 1,2 sum 3 count 2, not divisible','eq','false','',
    $q$ SELECT is_arithmetic(2) $q$),
  ('arithmetic_numbers','contains: 6 ∈, 2 ∉','eq','true|false','',
    $q$ SELECT (6::numeric <@ arithmetic_numbers())::text||'|'||(2::numeric <@ arithmetic_numbers())::text $q$),
  ('arithmetic_numbers','cardinality is infinite','eq','Infinity','',
    $q$ SELECT cardinality(arithmetic_numbers())::text $q$);
