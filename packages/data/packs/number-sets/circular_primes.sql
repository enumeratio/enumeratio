-- requires: number-theory, realizer
-- circular_primes — primes where EVERY cyclic rotation of the decimal digits is also prime (A068652 / A016114 orbits):
-- 2,3,5,7,11,13,17,31,37,71,73,79,97,113,131,197,199,311,… Base-10 specific. Multi-digit members use only {1,3,7,9}.
-- The predicate is_circular_prime rotates the digit string and primality-tests each rotation. The floor is a literal
-- seed (rotation-closed OEIS window — scanning naturals for the predicate is too costly); contains uses the predicate,
-- so it answers correctly for any value, not just the seeded window. Conjectured finite but unproven ⇒ carried as ∞.

CREATE FUNCTION is_circular_prime(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE s text := n::text; l int := length(n::text); i int; r numeric; BEGIN
    IF NOT is_prime_number(n) THEN RETURN false; END IF;
    FOR i IN 1..l-1 LOOP                                    -- each nontrivial rotation must be prime too
      r := (substr(s, i+1) || substr(s, 1, i))::numeric;
      IF NOT is_prime_number(r) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END $$;

CREATE FUNCTION circular_primes_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[2,3,5,7,11,13,17,31,37,71,73,79,97,113,131,197,199,311,337,373,719,733,919,971,991,
    1193,1931,3119,3779,7793,7937,9311,9377,11939,19391,19937,37199,39119,71993,91193,93719,93911,99371,
    193939,199933,319993,331999,391939,393919,919393,933199,939193,939391,993319,999331]::numeric[] $$;

CREATE TYPE circular_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f circular_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(circular_primes_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f circular_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_circular_prime(v) $$;

INSERT INTO base_collection VALUES ('circular_primes', 'numeric', true);   -- unbounded (conjectured), ungraded
CREATE FUNCTION fiber_symbol(f circular_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Circ' $$;   -- corpus symbol
SELECT base_realize('circular_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('circular_primes','first thirteen via the realized floor','eq','2,3,5,7,11,13,17,31,37,71,73,79,97','rotation-closed window',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(circular_primes(), 13) e $q$),
  ('circular_primes','contains via <@: 197 ∈ (197,971,719 prime), 19 ∉ (91 = 7·13)','eq','true|false','is_circular_prime',$q$
    SELECT (197::numeric <@ circular_primes())::text || '|' || (19::numeric <@ circular_primes())::text $q$),
  ('circular_primes','13 ∈ (31 prime) but 23 ∉ (32 even)','eq','true|false','the rotation must itself be prime',$q$
    SELECT (13::numeric <@ circular_primes())::text || '|' || (23::numeric <@ circular_primes())::text $q$),
  ('circular_primes','every seeded member is genuinely circular','ok',NULL,'the seed is closed under the predicate',$q$
    SELECT bool_and(is_circular_prime(v)) FROM unnest(circular_primes_seed()) v $q$);
