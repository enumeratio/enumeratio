-- requires: number-theory, realizer
-- carmichael_numbers — composite n that are Fermat pseudoprimes to EVERY base: a^n ≡ a (mod n) for all a (A002997):
-- 561,1105,1729,2465,2821,6601,8911,10585,… Korselt's criterion: n is squarefree AND (p−1)|(n−1) for every prime p|n
-- (⇒ every Carmichael has ≥ 3 prime factors). is_carmichael_number is exactly Korselt over factorize(). The floor is a
-- literal seed of the first 44 Carmichael numbers — the 43 below 10^6, plus 1024651 — verified against OEIS (the
-- sequence is far too sparse to scan); contains uses the predicate, correct for any value. Proved infinite
-- (Alford–Granville–Pomerance 1994) ⇒ ∞.

CREATE FUNCTION is_carmichael_number(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE f factorization; i int; BEGIN
    IF n < 561 OR mod(n, 2) = 0 THEN RETURN false; END IF;
    f := factorize(n);
    IF coalesce(array_length(f.primes, 1), 0) < 2 THEN RETURN false; END IF;   -- prime (or 1)
    FOR i IN 1..array_length(f.primes, 1) LOOP
      IF f.powers[i] > 1 THEN RETURN false; END IF;                            -- must be squarefree
      IF mod(n - 1, f.primes[i] - 1) <> 0 THEN RETURN false; END IF;           -- Korselt: (p−1) | (n−1)
    END LOOP;
    RETURN true;
  END $$;

CREATE FUNCTION carmichael_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[561,1105,1729,2465,2821,6601,8911,10585,15841,29341,41041,46657,52633,62745,63973,75361,
    101101,115921,126217,162401,172081,188461,252601,278545,294409,314821,334153,340561,399001,410041,449065,
    488881,512461,530881,552721,656601,658801,670033,748657,825265,838201,852841,997633,1024651]::numeric[] $$;

CREATE TYPE carmichael_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f carmichael_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(carmichael_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f carmichael_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_carmichael_number(v) $$;

INSERT INTO base_collection VALUES ('carmichael_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f carmichael_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Carm' $$;   -- corpus symbol
SELECT base_realize('carmichael_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('carmichael_numbers','first eight via the realized floor','eq','561,1105,1729,2465,2821,6601,8911,10585','A002997',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(carmichael_numbers(), 8) e $q$),
  ('carmichael_numbers','contains via <@: 1729 ∈ (7·13·19), 1728 ∉','eq','true|false','Korselt criterion',$q$
    SELECT (1729::numeric <@ carmichael_numbers())::text || '|' || (1728::numeric <@ carmichael_numbers())::text $q$),
  ('carmichael_numbers','the window pins 126217 in place (7·13·19·73, had been dropped)','eq','115921,126217,162401','A002997',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(carmichael_numbers(), 20) e WHERE ordinality(e) BETWEEN 17 AND 19 $q$),
  ('carmichael_numbers','126217 ∈ (Korselt: 6,12,18,72 all divide 126216)','eq','true','A002997',$q$
    SELECT (126217::numeric <@ carmichael_numbers())::text $q$),
  ('carmichael_numbers','561 ∈ (3·11·17; 2,10,16 all divide 560) — the smallest','eq','true','the least Carmichael',$q$
    SELECT (561::numeric <@ carmichael_numbers())::text $q$),
  ('carmichael_numbers','every member has ≥ 3 distinct prime factors','ok',NULL,'a Korselt consequence over the first window',$q$
    SELECT bool_and(little_omega((e).value) >= 3) FROM elements(carmichael_numbers(), 8) e $q$);
