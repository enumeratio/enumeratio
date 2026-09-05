-- requires: natural_numbers, number-predicates
-- prime_power_numbers — p^k with k ≥ 1, i.e. exactly ONE distinct prime factor (ω=1), A000961 (from 2): 2,3,4,5,7,8,9,…
-- A base_restrict specialization of natural_numbers: the floor filters the naturals ascending by
-- is_prime_power_number (delegating to is_prime_power(factored) — ω=1 on the exponent vector). Ungraded / unbounded.
SELECT base_restrict('prime_power_numbers', 'natural_numbers', 'is_prime_power_number');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prime_power_numbers','first ten via the realized floor','eq','2,3,4,5,7,8,9,11,13,16','a restriction of the naturals',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_power_numbers(), 10) e $q$),
  ('prime_power_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(prime_power_numbers()) f LIMIT 1) FROM fibers(prime_power_numbers()) $q$),
  ('prime_power_numbers','unrank(5) = 8 (the 6th prime power = 2^3)','eq','8','rank 5 (0-based): 2,3,4,5,7,8,…',$q$
    SELECT (unrank(prime_power_numbers(), 5)).value::text $q$),
  ('prime_power_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(prime_power_numbers())::text $q$),
  ('prime_power_numbers','contains via <@: 16 ∈ (2^4), 12 ∉ (2^2·3, ω=2)','eq','true|false','the ω=1 boundary — one distinct prime',$q$
    SELECT (16::numeric <@ prime_power_numbers())::text || '|' || (12::numeric <@ prime_power_numbers())::text $q$),
  ('prime_power_numbers','parent is natural_numbers','eq','natural_numbers|is_prime_power_number','base_collection_parent records the specialization',$q$
    SELECT parent || '|' || predicate FROM base_collection_parent WHERE collection = 'prime_power_numbers' $q$);
