-- requires: number-theory, realizer
-- cousin_primes — ported from pg-enumeratio-core_old_backup/sqlsrc/more-sequences-and-primes.sql.
-- Lesser of cousin primes (A023200): primes p with p+4 also prime — 3,7,13,19,37,43,67,79,…
-- Reuses is_prime_number (number-theory.sql). Unbounded number set: predicate over the naturals.

CREATE FUNCTION is_cousin_prime(p numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(p) AND is_prime_number(p + 4) $$;

CREATE TYPE cousin_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f cousin_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(2, greatest(element_limit * 40, 200)) n WHERE is_cousin_prime(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f cousin_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_cousin_prime(v) $$;

INSERT INTO base_collection VALUES ('cousin_primes', 'numeric', true);                          -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f cousin_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Cousin' $$;   -- corpus symbol
SELECT base_realize('cousin_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('cousin_primes','lesser of cousin primes (A023200)','eq','3,7,13,19,37,43,67,79','p, p+4 both prime',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(cousin_primes(), 8) e $q$),
  ('cousin_primes','unrank(3) = 19 (4th term, 0-based rank 3)','eq','19','',$q$
    SELECT (unrank(cousin_primes(), 3)).value::text $q$),
  ('cousin_primes','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(cousin_primes())::text $q$),
  ('cousin_primes','contains via <@: 7 ∈ (7,11 both prime), 9 ∉ (not prime)','eq','true|false','',$q$
    SELECT (7::numeric <@ cousin_primes())::text || '|' || (9::numeric <@ cousin_primes())::text $q$),
  ('cousin_primes','structural invariant: every listed term p has p and p+4 prime','eq','true','',$q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number((e).value + 4)) FROM elements(cousin_primes(), 8) e $q$);
