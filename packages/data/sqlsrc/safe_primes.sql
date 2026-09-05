-- requires: number-theory, realizer
-- safe_primes (A005385), ported from pg-enumeratio-core_old_backup/sqlsrc/number-theory-sets.sql: a prime p is
-- "safe" when (p-1)/2 is also prime (its Sophie Germain "matching" prime q = (p-1)/2, i.e. p = 2q+1). First
-- members 5,7,11,23,47,59,83,107,… Unbounded number set (carrier numeric); reuses is_prime_number (45).
CREATE FUNCTION is_safe_prime(p numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p > 2 AND is_prime_number(p) AND is_prime_number(div(p - 1, 2)) $$;
CREATE TYPE safe_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f safe_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit * 40 + 200) n WHERE is_safe_prime(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f safe_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_safe_prime(v) $$;
INSERT INTO base_collection VALUES ('safe_primes', 'numeric', true);
CREATE FUNCTION fiber_symbol(f safe_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Safe' $$;   -- corpus symbol
SELECT base_realize('safe_primes');
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('safe_primes', 'first eight', 'eq', '5,7,11,23,47,59,83,107', 'A005385 — p prime with (p-1)/2 also prime', $q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(safe_primes(), 8) e $q$),
  ('safe_primes', 'unrank(4) = 47 (the 5th safe prime)', 'eq', '47', 'rank 4 (0-based)', $q$
    SELECT (unrank(safe_primes(), 4)).value::text $q$),
  ('safe_primes', 'structural invariant: every element is prime with (p-1)/2 prime', 'eq', 'true', 'bool_and over the first window', $q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number(div((e).value - 1, 2)))::text
    FROM elements(safe_primes(), 12) e $q$),
  ('safe_primes', 'contains: 23 ∈ (23 prime, (23-1)/2=11 prime), 13 ∉ ((13-1)/2=6 not prime)', 'eq', 'true|false', '', $q$
    SELECT (23::numeric <@ safe_primes())::text || '|' || (13::numeric <@ safe_primes())::text $q$);
