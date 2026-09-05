-- requires: number-theory, realizer
-- emirp_primes — a prime whose decimal reversal is a DIFFERENT prime ("emirp" = "prime" reversed) (A006567):
-- 13,17,31,37,71,73,79,97,107,113,… Excludes palindromic primes (reversal = self). Ungraded / infinite number SET.
-- The floor scans a bound that SCALES with element_limit (#296, capped at the original 20000) keeping emirps
-- ascending; contains is the same predicate. Unbounded ⇒ cardinality ∞.

CREATE FUNCTION is_emirp_prime(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(n) AND reverse(n::text)::numeric <> n AND is_prime_number(reverse(n::text)::numeric) $$;

CREATE TYPE emirp_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f emirp_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(10, least(greatest(element_limit * 300, 300), 20000)) n
   WHERE is_emirp_prime(n::numeric) ORDER BY n LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f emirp_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_emirp_prime(v) $$;

INSERT INTO base_collection VALUES ('emirp_primes', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f emirp_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Emirp' $$;   -- corpus symbol
SELECT base_realize('emirp_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('emirp_primes','first ten via the realized floor','eq','13,17,31,37,71,73,79,97,107,113','A006567',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(emirp_primes(), 10) e $q$),
  ('emirp_primes','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(emirp_primes())::text $q$),
  ('emirp_primes','contains via <@: 37 ∈ (37↔73), 11 ∉ (palindromic)','eq','true|false','reversal is a distinct prime',$q$
    SELECT (37::numeric <@ emirp_primes())::text || '|' || (11::numeric <@ emirp_primes())::text $q$),
  ('emirp_primes','each member reverses to a distinct prime','ok',NULL,'structural invariant over the first window',$q$
    SELECT bool_and(is_prime_number(reverse((e).value::text)::numeric) AND reverse((e).value::text)::numeric <> (e).value) FROM elements(emirp_primes(), 10) e $q$);
