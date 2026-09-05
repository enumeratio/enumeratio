-- requires: harshad_numbers, number-theory, realizer
-- smith_numbers — composite numbers whose decimal digit sum equals the sum (with multiplicity) of the decimal
-- digit sums of their prime factors (A006753): 4,22,27,58,85,94,121,166,202,265,… Unbounded number set.
CREATE FUNCTION is_smith(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n > 1 AND NOT is_prime_number(n)
     AND decimal_digit_sum(n) = (SELECT sum(e * decimal_digit_sum(p)) FROM unnest((factorize(n)).primes, (factorize(n)).powers) AS t(p, e))
$$;
CREATE TYPE smith_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f smith_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, 200) n WHERE is_smith(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f smith_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_smith(v) $$;
INSERT INTO base_collection VALUES ('smith_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f smith_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Smith' $$;   -- corpus symbol
SELECT base_realize('smith_numbers');

INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('smith_numbers','first eight','eq','4,22,27,58,85,94,121,166','digit sum = Σ (multiplicity · digit sum of prime factor)',$q$
    SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(smith_numbers(),8) e $q$),
  ('smith_numbers','worked check: 22 = 2·11, digitsum(22)=4 = digitsum(2)+digitsum(11)','eq','4|4','2+2=4 and digitsum(22)=2+2=4',$q$
    SELECT decimal_digit_sum(22)::text || '|' || (SELECT sum(e * decimal_digit_sum(p)) FROM unnest((factorize(22)).primes,(factorize(22)).powers) AS t(p,e))::text $q$),
  ('smith_numbers','contains via <@: 22 ∈ (smith), 23 ∉ (prime)','eq','true|false','',$q$
    SELECT (22::numeric <@ smith_numbers())::text || '|' || (23::numeric <@ smith_numbers())::text $q$),
  ('smith_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$ SELECT cardinality(smith_numbers())::text $q$);
