-- requires: number-theory, realizer
-- sophie_germain_primes — ported from pg-enumeratio-core_old_backup/sqlsrc/number-theory-sets.sql.
-- Sophie Germain prime p: p prime AND 2p+1 also prime (A005384): 2,3,5,11,23,29,41,53,83,89,…
-- Unbounded number set (predicate-scan floor over the naturals); reuses is_prime_number.

CREATE FUNCTION is_sophie_germain_prime(p numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(p) AND is_prime_number(2 * p + 1)
$$;

CREATE TYPE sophie_germain_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f sophie_germain_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit * 15 + 50) n WHERE is_sophie_germain_prime(n::numeric) LIMIT element_limit
$$;
CREATE FUNCTION contains_in_fiber(f sophie_germain_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_sophie_germain_prime(v)
$$;

INSERT INTO base_collection VALUES ('sophie_germain_primes', 'numeric', true);                   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f sophie_germain_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SG' $$;   -- corpus symbol
SELECT base_realize('sophie_germain_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sophie_germain_primes', 'first eight via elements()', 'eq', '2,3,5,11,23,29,41,53', 'A005384 — p with 2p+1 also prime.', $q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(sophie_germain_primes(), 8) e $q$),
  ('sophie_germain_primes', 'unrank(4) = 23 (the 5th term, 0-based)', 'eq', '23', 'rank 4 (0-based)', $q$
    SELECT (unrank(sophie_germain_primes(), 4)).value::text $q$),
  ('sophie_germain_primes', 'structural invariant: p and 2p+1 both prime', 'eq', 'true', 'every emitted term satisfies the defining pair-primality', $q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number(2 * (e).value + 1))
    FROM elements(sophie_germain_primes(), 8) e $q$),
  ('sophie_germain_primes', 'cardinality = infinity', 'eq', 'Infinity', 'unbounded', $q$
    SELECT cardinality(sophie_germain_primes())::text $q$),
  ('sophie_germain_primes', 'contains via <@: 2 ∈ (2·2+1=5 prime), 7 ∉ (2·7+1=15=3·5)', 'eq', 'true|false', '', $q$
    SELECT (2::numeric <@ sophie_germain_primes())::text || '|' || (7::numeric <@ sophie_germain_primes())::text $q$);
