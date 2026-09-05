-- requires: number-theory, realizer
-- palindromic_primes — primes reading the same forwards and backwards in base 10 (A002385): 2,3,5,7,11,101,131,…
-- An ungraded / infinite number SET (carrier numeric), sibling of prime_numbers. The predicate is the cheap
-- palindrome string test AND is_prime_number; the floor scans a generous bound, palindrome-filtering FIRST (string
-- test is far cheaper than primality) so only the handful of palindromes pay for a primality check. Base-10 specific.
-- 11 is the only even-digit palindromic prime (2k-digit palindromes are divisible by 11). Unbounded ⇒ cardinality ∞.

CREATE FUNCTION is_palindromic_prime(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n >= 2 AND n::text = reverse(n::text) AND is_prime_number(n) $$;

CREATE TYPE palindromic_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f palindromic_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT p FROM (SELECT g::numeric p FROM generate_series(1, 200000) g WHERE g::text = reverse(g::text)) q
   WHERE is_prime_number(p) ORDER BY p LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f palindromic_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_palindromic_prime(v) $$;

INSERT INTO base_collection VALUES ('palindromic_primes', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f palindromic_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'PalPrime' $$;   -- corpus symbol
SELECT base_realize('palindromic_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('palindromic_primes','first ten via the realized floor','eq','2,3,5,7,11,101,131,151,181,191','A002385',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(palindromic_primes(), 10) e $q$),
  ('palindromic_primes','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(palindromic_primes())::text $q$),
  ('palindromic_primes','contains via <@: 131 ∈, 137 ∉ (prime, not palindrome)','eq','true|false','is_palindromic_prime',$q$
    SELECT (131::numeric <@ palindromic_primes())::text || '|' || (137::numeric <@ palindromic_primes())::text $q$),
  ('palindromic_primes','11 is the only even-digit member ≤ 200000','eq','11','2k-digit palindromes are divisible by 11',$q$
    SELECT min(p)::text FROM (SELECT g p FROM generate_series(1,200000) g WHERE g::text = reverse(g::text) AND length(g::text) % 2 = 0) q WHERE is_prime_number(p::numeric) $q$),
  ('palindromic_primes','each member reads the same reversed','ok',NULL,'structural invariant over the first window',$q$
    SELECT bool_and((e).value::text = reverse((e).value::text)) FROM elements(palindromic_primes(), 10) e $q$);
