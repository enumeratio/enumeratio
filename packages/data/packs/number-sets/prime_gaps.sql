-- requires: number-theory, realizer
-- prime_gaps — the smaller prime p_n of each consecutive prime pair, carrying the gap g(n) = p_{n+1} − p_n (A001223).
-- The element set is exactly the primes (every prime is the lower end of its gap to the next prime), so the floor reuses
-- nth_prime and contains is is_prime_number; what distinguishes this collection from prime_numbers is the gap reading
-- (prime_gap below). Unbounded ⇒ cardinality ∞. Addressed by the smaller prime: @3 is the gap 3→5.

CREATE FUNCTION prime_gap(p numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT next_prime_number_after(p) - p $$;

CREATE TYPE prime_gaps_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f prime_gaps_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT nth_prime(r + 1) FROM generate_series(0, element_limit - 1) r $$;   -- rank r → the (r+1)-th prime (lower end)
CREATE FUNCTION contains_in_fiber(f prime_gaps_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_prime_number(v) $$;

INSERT INTO base_collection VALUES ('prime_gaps', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f prime_gaps_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Gap' $$;   -- corpus symbol
SELECT base_realize('prime_gaps');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prime_gaps','first ten lower primes via the realized floor','eq','2,3,5,7,11,13,17,19,23,29','the smaller prime of each pair',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_gaps(), 10) e $q$),
  ('prime_gaps','the gap sequence g(n) for the first ten','eq','1,2,2,4,2,4,2,4,6,2','A001223 — g(n)=p_{n+1}−p_n',$q$
    SELECT string_agg(prime_gap((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(prime_gaps(), 10) e $q$),
  ('prime_gaps','the only odd gap is g=1 at p=2 (2→3); all later gaps are even','ok',NULL,'parity of prime gaps',$q$
    SELECT prime_gap(2) = 1 AND bool_and(mod(prime_gap((e).value)::int, 2) = 0) FROM elements(prime_gaps(), 10) e WHERE (e).value > 2 $q$),
  ('prime_gaps','contains via <@: 23 ∈ (23→29, gap 6), 24 ∉','eq','true|false','the elements are the primes',$q$
    SELECT (23::numeric <@ prime_gaps())::text || '|' || (24::numeric <@ prime_gaps())::text $q$);
