-- requires: number-theory, realizer, prime_pairs
-- sexy_primes — the LESSER member of a sexy prime pair (A023201): p prime with p+6 also prime.
-- 5,7,11,13,17,23,31,37,41,47,53,61,67,73,83,… Number set. Ported from
-- pg-enumeratio-core_old_backup/sqlsrc/more-sequences-and-primes.sql, whose is_sexy_prime(p) is exactly
-- is_prime_number(p) AND is_prime_number(p+6) (canonical_order 'ascending'). Kept lesser-member-only for
-- consistency with twin_primes / cousin_primes (all three are "lesser of the pair" sets). Reuses is_prime_number.
-- (#67) requires prime_pairs so the gap=6 point row below resolves.

CREATE FUNCTION is_sexy_prime(p numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(p) AND is_prime_number(p + 6) $$;

CREATE TYPE sexy_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f sexy_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(2, element_limit * 12 + 120) n WHERE is_sexy_prime(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f sexy_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_sexy_prime(v) $$;

INSERT INTO base_collection VALUES ('sexy_primes', 'numeric', true);
CREATE FUNCTION fiber_symbol(f sexy_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Sexy' $$;   -- corpus symbol
SELECT base_realize('sexy_primes');
-- (#67) sexy_primes is the gap=6 point of prime_pairs (realized point).
INSERT INTO base_family_point (collection, family, bindings) VALUES ('sexy_primes', 'prime_pairs', '{"gap": 6}');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sexy_primes','first eight (lesser of pair) — A023201','eq','5,7,11,13,17,23,31,37','p prime, p+6 prime',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(sexy_primes(), 8) e $q$),
  ('sexy_primes','each member p has p+6 also prime','eq','true','structural invariant over the first window',$q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number((e).value + 6))::text FROM elements(sexy_primes(), 12) e $q$),
  ('sexy_primes','contains: 5 ∈ (5,11 both prime), 19 ∉ (19+6=25 not prime)','eq','true|false','',$q$
    SELECT (5::numeric <@ sexy_primes())::text || '|' || (19::numeric <@ sexy_primes())::text $q$),
  ('sexy_primes','unrank(7) = 37 (the 8th sexy prime)','eq','37','rank 7 (0-based)',$q$
    SELECT (unrank(sexy_primes(), 7)).value::text $q$),
  ('sexy_primes','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(sexy_primes())::text $q$),
  ('sexy_primes','(#67) sexy_primes ≡ prime_pairs(gap => 6), element-for-element (first 12)','eq','true','the point differential',$q$
    SELECT (
      (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(sexy_primes(), 12) e)
      = (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(prime_pairs(6), 12) e))::text $q$);
