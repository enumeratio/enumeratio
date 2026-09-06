-- requires: number-theory, realizer, prime_pairs
-- twin_primes — the LESSER member of a twin prime pair (A001359): p prime with p+2 also prime.
-- 3,5,11,17,29,41,59,71,101,107,… Number set. Ported from pg-enumeratio-core_old_backup/sqlsrc/number-theory-sets.sql
-- (is_twin_prime predicate + twin_primes collection, canonical_order 'ascending'). Reuses is_prime_number.
CREATE FUNCTION is_twin_prime(p numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(p) AND is_prime_number(p + 2) $$;
CREATE TYPE twin_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f twin_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit * 12 + 120) n WHERE is_twin_prime(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f twin_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_twin_prime(v) $$;
INSERT INTO base_collection VALUES ('twin_primes','numeric',true);
CREATE FUNCTION fiber_symbol(f twin_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Twin' $$;   -- corpus symbol
SELECT base_realize('twin_primes');
-- (#67) twin_primes is the gap=2 point of prime_pairs — a realized point (owns this tower).
INSERT INTO base_family_point (collection, family, bindings) VALUES ('twin_primes', 'prime_pairs', '{"gap": 2}');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('twin_primes','first eight (lesser of pair)','eq','3,5,11,17,29,41,59,71','A001359 — p prime, p+2 prime',$q$
    SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(twin_primes(),8) e $q$),
  ('twin_primes','each member p has p+2 also prime','ok',NULL,'structural invariant over the first window',$q$
    SELECT bool_and(is_prime_number((e).value) AND is_prime_number((e).value + 2)) FROM elements(twin_primes(),8) e $q$),
  ('twin_primes','contains: 11 ∈ (11,13 twin), 23 ∉ (23,25 not)','eq','true|false','',$q$
    SELECT (11::numeric <@ twin_primes())::text||'|'||(23::numeric <@ twin_primes())::text $q$),
  ('twin_primes','unrank(7) = 71 (the 8th twin prime)','eq','71','rank 7 (0-based)',$q$
    SELECT (unrank(twin_primes(), 7)).value::text $q$),
  ('twin_primes','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(twin_primes())::text $q$),
  ('twin_primes','(#67) twin_primes ≡ prime_pairs(gap => 2), element-for-element (first 15)','eq','true','the point differential proving the family reproduces the legacy tower',$q$
    SELECT (
      (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(twin_primes(), 15) e)
      = (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(prime_pairs(2), 15) e))::text $q$);
