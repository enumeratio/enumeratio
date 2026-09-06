-- requires: realizer, utilities
-- Number-theory primitives (simple, self-contained — trial division; fine for moderate n) + prime_numbers as a
-- realized collection. Proves "numbers aren't special": prime_numbers is an ungraded/infinite collection just
-- like fibonacci, and classical predicates are shape constraints on the exponent vector (Ω/ω).

CREATE FUNCTION is_prime_number(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE d numeric := 3; BEGIN
    IF n < 2 THEN RETURN false; END IF;
    IF n = 2 THEN RETURN true; END IF;
    IF mod(n, 2) = 0 THEN RETURN false; END IF;
    WHILE d*d <= n LOOP IF mod(n, d) = 0 THEN RETURN false; END IF; d := d + 2; END LOOP;
    RETURN true;
  END $$;
CREATE FUNCTION next_prime_number_after(m numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n numeric := trunc(m) + 1; BEGIN WHILE NOT is_prime_number(n) LOOP n := n + 1; END LOOP; RETURN n; END $$;
CREATE FUNCTION nth_prime(k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- 1-based omega_ordinal: nth_prime(1)=2
  DECLARE p numeric := 2; i int; BEGIN IF k < 1 THEN RETURN NULL; END IF; FOR i IN 2..k LOOP p := next_prime_number_after(p); END LOOP; RETURN p; END $$;
CREATE FUNCTION prime_counting(n numeric) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_series(2, greatest(trunc(n)::bigint, 1)) k WHERE is_prime_number(k) $$;

-- lightweight factorization (prime bases + exponents) + the exponent-vector stats Ω, ω
CREATE TYPE factorization AS (primes numeric[], powers int[]);
CREATE FUNCTION factorize(n numeric) RETURNS factorization LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric := n; d numeric := 2; e int; ps numeric[] := '{}'; es int[] := '{}'; BEGIN
    WHILE d*d <= m LOOP
      IF mod(m, d) = 0 THEN e := 0; WHILE mod(m, d) = 0 LOOP m := div(m, d); e := e + 1; END LOOP; ps := ps || d; es := es || e; END IF;
      d := d + 1;
    END LOOP;
    IF m > 1 THEN ps := ps || m; es := es || 1; END IF;
    RETURN ROW(ps, es);
  END $$;
CREATE FUNCTION big_omega(n numeric)    RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(sum(e)::int, 0) FROM unnest((factorize(n)).powers) e $$;
CREATE FUNCTION little_omega(n numeric)  RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(array_length((factorize(n)).primes, 1), 0) $$;
-- greatest / least prime factor and the largest prime exponent — the recoverable stats the #67 threshold families
-- (smooth/rough/k_free) threshold over. gpf/spf return NULL for n <= 1 (no prime factors — vacuously smooth AND rough).
CREATE FUNCTION greatest_prime_factor(n numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT max(p) FROM unnest((factorize(n)).primes) p $$;
CREATE FUNCTION least_prime_factor(n numeric)    RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT min(p) FROM unnest((factorize(n)).primes) p $$;
CREATE FUNCTION max_prime_exponent(n numeric)    RETURNS int     LANGUAGE sql IMMUTABLE AS $$ SELECT coalesce(max(e), 0)::int FROM unnest((factorize(n)).powers) e $$;

-- exponent-vector shape helpers (on top of factorize/Ω/ω) for the power/sphenic number families — hoisted from
-- power-shapes.sql (#283 §3.3: shared by achilles_numbers, perfect_power_numbers, powerful_numbers, sphenic_numbers).
CREATE FUNCTION exponent_gcd(n numeric) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE g int := 0; e int; BEGIN FOREACH e IN ARRAY (factorize(n)).powers LOOP g := gcd_int(g, e); END LOOP; RETURN g; END $$;
CREATE FUNCTION is_powerful(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- every prime exponent >= 2 (1 vacuously)
  SELECT n >= 1 AND coalesce((SELECT bool_and(e >= 2) FROM unnest((factorize(n)).powers) e), true) $$;
CREATE FUNCTION is_perfect_power(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- m^k, k>=2 ⇔ gcd(exps) >= 2
  SELECT n = 1 OR (n >= 4 AND exponent_gcd(n) >= 2) $$;
CREATE FUNCTION is_achilles(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_powerful(n) AND NOT is_perfect_power(n) $$;
CREATE FUNCTION is_sphenic(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big_omega(n) = 3 AND little_omega(n) = 3 $$;   -- 3 distinct primes

-- Möbius μ(n) and Euler's totient φ(n) — from the same factorization, for the necklace/Lyndon-word closed forms
-- (issue #172): |Lyndon_k(n)| = (1/n)Σ_{d|n} μ(d)k^(n/d), |necklaces_k(n)| = (1/n)Σ_{d|n} φ(d)k^(n/d).
CREATE FUNCTION mobius_function(n int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN n = 1 THEN 1
    WHEN EXISTS (SELECT 1 FROM unnest((factorize(n::numeric)).powers) e WHERE e > 1) THEN 0   -- not squarefree
    WHEN mod(coalesce(array_length((factorize(n::numeric)).primes, 1), 0), 2) = 0 THEN 1       -- even # of prime factors
    ELSE -1
  END $$;
CREATE FUNCTION euler_phi(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- n·Π(1−1/p); each step exact (p always divides result)
  DECLARE result numeric := n; p numeric; BEGIN
    IF n <= 0 THEN RETURN 0; END IF;
    FOR p IN SELECT unnest((factorize(n::numeric)).primes) LOOP result := div(result, p) * (p - 1); END LOOP;
    RETURN result;
  END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('number-theory','mobius_function: μ(1)=1, μ(6)=1 (two distinct primes), μ(12)=0 (not squarefree), μ(30)=−1 (three primes)','eq','1|1|0|-1','A008683',$q$
    SELECT mobius_function(1)::text || '|' || mobius_function(6)::text || '|' || mobius_function(12)::text || '|' || mobius_function(30)::text $q$),
  ('number-theory','euler_phi: φ(1)=1, φ(9)=6, φ(10)=4, φ(13)=12 (prime)','eq','1|6|4|12','A000010',$q$
    SELECT euler_phi(1)::text || '|' || euler_phi(9)::text || '|' || euler_phi(10)::text || '|' || euler_phi(13)::text $q$);

-- hoisted from power-shapes.sql (#283 §3.3)
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('power-shapes','exponent_gcd: 72=2^3·3^2 → gcd(3,2)=1 (powerful, not a perfect power)','eq','1|true|false','achilles',$q$
    SELECT exponent_gcd(72)::text || '|' || is_powerful(72)::text || '|' || is_perfect_power(72)::text $q$);

-- prime_numbers: an ungraded / infinite collection (carrier numeric), floor = the r-th prime.
CREATE TYPE prime_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f prime_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT nth_prime(r + 1) FROM generate_series(0, element_limit - 1) r $$;                      -- rank r (0-based) → (r+1)-th prime
CREATE FUNCTION contains_in_fiber(f prime_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_prime_number(v) $$;

INSERT INTO base_collection VALUES ('prime_numbers', 'numeric', true);                          -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f prime_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℙ' $$;   -- corpus symbol
-- value→value step (capability: steppable / reversible) — the next/previous prime by search, NO rank needed. This is
-- the case the capability ladder is FOR: primes have no closed-form unrank, but a cheap successor from any value.
CREATE FUNCTION successor(f prime_numbers_fiber, p numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE q numeric := p + 1; BEGIN WHILE NOT is_prime_number(q) LOOP q := q + 1; END LOOP; RETURN q; END $$;
CREATE FUNCTION predecessor(f prime_numbers_fiber, p numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE q numeric := p - 1; BEGIN IF p <= 2 THEN RETURN NULL; END IF; WHILE NOT is_prime_number(q) LOOP q := q - 1; END LOOP; RETURN q; END $$;
SELECT base_realize('prime_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('number-theory','first primes via the realized floor','eq','2,3,5,7,11,13,17,19,23,29','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(prime_numbers(), 10) e $q$),
  ('number-theory','unrank(5) = 13 (the 6th prime)','eq','13','rank 5 (0-based)',$q$
    SELECT (unrank(prime_numbers(), 5)).value::text $q$),
  ('number-theory','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(prime_numbers())::text $q$),
  ('number-theory','contains via <@: 13 ∈, 14 ∉','eq','true|false','is_prime_number',$q$
    SELECT (13::numeric <@ prime_numbers())::text || '|' || (14::numeric <@ prime_numbers())::text $q$),
  ('number-theory','shape constraints on the exponent vector: Ω(12)=3, ω(12)=2','eq','3|2','12 = 2^2·3',$q$
    SELECT big_omega(12)::text || '|' || little_omega(12)::text $q$),
  ('number-theory','Ω=1 ⇔ prime; least Ω=k is 2^k (k=3 → 8)','eq','8','k-almost-primes as an Ω shape constraint',$q$
    SELECT min(n)::text FROM generate_series(2,60) n WHERE big_omega(n) = 3 $q$);

-- prime_numbers-specific examples (the collection facet), distinct from the number-theory shape view above
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('prime_numbers','the least prime is 2 (unrank 0)','eq','2','rank 0 of the one infinite fiber',$q$
    SELECT (unrank(prime_numbers(), 0)).value::text $q$),
  ('prime_numbers','the 25th prime (rank 24) is 97','eq','97','the floor unranks by 0-based position',$q$
    SELECT (unrank(prime_numbers(), 24)).value::text $q$),
  ('prime_numbers','the 100th prime (rank 99) is 541','eq','541','arbitrarily deep into the unbounded sequence',$q$
    SELECT (unrank(prime_numbers(), 99)).value::text $q$),
  ('prime_numbers','membership via <@: 97 ∈, 91 = 7·13 ∉','eq','true|false','is_prime_number',$q$
    SELECT (97::numeric <@ prime_numbers())::text || '|' || (91::numeric <@ prime_numbers())::text $q$),
  ('prime_numbers','2 is the only even prime: rank 0 is even, ranks 1..9 are odd','eq','true','a fact about the sequence, not one value',$q$
    SELECT (mod((unrank(prime_numbers(),0)).value::int, 2) = 0
        AND bool_and(mod((unrank(prime_numbers(),r)).value::int, 2) = 1))::text FROM generate_series(1,9) r $q$);
