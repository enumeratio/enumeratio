-- requires: number-theory, realizer, utilities
-- k_almost_primes — integers with exactly k prime factors counted WITH multiplicity (Ω(n)=k). A GRADED number
-- collection (grade [k]) whose fibers are INFINITE (graded + unbounded): each Ω=k fiber is an endless ascending
-- scan. k=1 recovers the primes; k=2 the semiprimes. Reuses big_omega from 45-number-theory.

CREATE TYPE k_almost_primes_fiber AS (k natural_number);   -- typed fiber; axis: k
CREATE FUNCTION fiber_elements(f k_almost_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(2, element_limit*element_limit*4 + 200) n
   WHERE big_omega(n) = (f).k::int ORDER BY n LIMIT element_limit $$;              -- the r-th n with Ω(n)=k
CREATE FUNCTION contains_in_fiber(f k_almost_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big_omega(v) = (f).k::int $$;

INSERT INTO base_collection VALUES ('k_almost_primes', 'numeric', true);          -- unbounded fibers
INSERT INTO base_grade VALUES ('k_almost_primes', 1, 'k', NULL, NULL);            -- graded by k = Ω (bind a point)
CREATE FUNCTION fiber_symbol(f k_almost_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℙ' || to_unicode_subscript((f).k) $$;   -- corpus symbol
SELECT base_realize('k_almost_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_almost_primes','k=2 (semiprimes): first ten','eq','4,6,9,10,14,15,21,22,25,26','the Ω=2 fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(k_almost_primes(2), 10) e $q$),
  ('k_almost_primes','k=1 = the primes: first ten','eq','2,3,5,7,11,13,17,19,23,29','Ω=1 recovers primes',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(k_almost_primes(1), 10) e $q$),
  ('k_almost_primes','least of the Ω=k fiber is 2^k (k=3 → 8)','eq','8','unrank rank 0 of the k=3 fiber',$q$
    SELECT (unrank(k_almost_primes(3), 0)).value::text $q$),
  ('k_almost_primes','graded + unbounded: cardinality = infinity','eq','Infinity','each Ω=k fiber is infinite',$q$
    SELECT cardinality(k_almost_primes(2))::text $q$),
  ('k_almost_primes','contains via <@: 12 ∈ Ω=3, ∉ Ω=2','eq','true|false','12 = 2^2·3, Ω=3',$q$
    SELECT (12::numeric <@ k_almost_primes(3))::text || '|' || (12::numeric <@ k_almost_primes(2))::text $q$);
