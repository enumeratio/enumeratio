-- requires: number-theory, realizer
-- mersenne_primes — primes of the form M_p = 2^p − 1 with p prime (A000668): 3,7,31,127,8191,131071,524287,2147483647.
-- 8 within MAX_SAFE_INTEGER (p = 2,3,5,7,13,17,19,31); the next, M_61 ≈ 2.3×10^18, is out of range. Euclid–Euler:
-- M_p is a Mersenne prime iff 2^{p-1}·M_p is perfect. The floor is a literal seed; contains is the honest predicate
-- (a power-of-two-minus-one that is prime). Conjectured infinite ⇒ carried as ∞.

CREATE FUNCTION is_mersenne_prime(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric := n + 1; BEGIN
    IF n < 3 THEN RETURN false; END IF;
    WHILE m > 1 AND mod(m, 2) = 0 LOOP m := m / 2; END LOOP;  -- n+1 must be a pure power of two
    IF m <> 1 THEN RETURN false; END IF;
    RETURN is_prime_number(n);
  END $$;

CREATE FUNCTION mersenne_primes_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[3,7,31,127,8191,131071,524287,2147483647]::numeric[] $$;

CREATE TYPE mersenne_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f mersenne_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(mersenne_primes_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f mersenne_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_mersenne_prime(v) $$;

INSERT INTO base_collection VALUES ('mersenne_primes', 'numeric', true);   -- unbounded (conjectured), ungraded
CREATE FUNCTION fiber_symbol(f mersenne_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Mers' $$;   -- corpus symbol
SELECT base_realize('mersenne_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('mersenne_primes','the eight within range via the realized floor','eq','3,7,31,127,8191,131071,524287,2147483647','A000668 ≤ MAX_SAFE_INTEGER',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(mersenne_primes(), 20) e $q$),
  ('mersenne_primes','unrank(2) = 31 (M_5 = 2^5 − 1)','eq','31','rank 2 (0-based)',$q$
    SELECT (unrank(mersenne_primes(), 2)).value::text $q$),
  ('mersenne_primes','contains via <@: 127 ∈ (M_7), 63 ∉ (2^6 − 1 = 7·9)','eq','true|false','2^p − 1 prime, p prime',$q$
    SELECT (127::numeric <@ mersenne_primes())::text || '|' || (63::numeric <@ mersenne_primes())::text $q$),
  ('mersenne_primes','2047 = M_11 ∉ (2047 = 23·89, though 11 is prime)','eq','false','p prime does not force M_p prime',$q$
    SELECT (2047::numeric <@ mersenne_primes())::text $q$);
