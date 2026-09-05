-- requires: number-theory, realizer
-- fibonacci_primes — primes that are also Fibonacci numbers (A005478): 2,3,5,13,89,233,1597,28657,514229,433494437,
-- 2971215073. A FINITE realized set (11 values ≤ MAX_SAFE_INTEGER; next is F_83 ≈ 10^17, out of range). The floor is a
-- literal seed; contains is the honest predicate is_prime_number ∧ is_fibonacci_number (correct beyond the window too).
-- Bounded ⇒ cardinality = 11.

CREATE FUNCTION is_fibonacci_number(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 0; b numeric := 1; t numeric; BEGIN
    IF n < 0 THEN RETURN false; END IF;
    WHILE b < n LOOP t := a + b; a := b; b := t; END LOOP;
    RETURN b = n OR n = 0;                                  -- 0,1,1,2,3,5,8,… (n=0 and n=1 both members)
  END $$;

CREATE FUNCTION fibonacci_primes_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[2,3,5,13,89,233,1597,28657,514229,433494437,2971215073]::numeric[] $$;

CREATE TYPE fibonacci_primes_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f fibonacci_primes_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(fibonacci_primes_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f fibonacci_primes_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_prime_number(v) AND is_fibonacci_number(v) $$;

INSERT INTO base_collection VALUES ('fibonacci_primes', 'numeric', false);   -- bounded (finite within range), ungraded
CREATE FUNCTION fiber_symbol(f fibonacci_primes_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'FibPrime' $$;   -- corpus symbol
SELECT base_realize('fibonacci_primes');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fibonacci_primes','all eleven via the realized floor','eq','2,3,5,13,89,233,1597,28657,514229,433494437,2971215073','A005478 ≤ MAX_SAFE_INTEGER',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fibonacci_primes(), 20) e $q$),
  ('fibonacci_primes','cardinality = 11 (finite within range)','eq','11','bounded',$q$
    SELECT cardinality(fibonacci_primes())::text $q$),
  ('fibonacci_primes','contains via <@: 89 ∈, 21 ∉ (Fibonacci but 21 = 3·7)','eq','true|false','prime ∧ Fibonacci',$q$
    SELECT (89::numeric <@ fibonacci_primes())::text || '|' || (21::numeric <@ fibonacci_primes())::text $q$),
  ('fibonacci_primes','233 ∈ (F_13 prime) but 144 ∉ (F_12 = 12²)','eq','true|false','Fibonacci alone is not enough',$q$
    SELECT (233::numeric <@ fibonacci_primes())::text || '|' || (144::numeric <@ fibonacci_primes())::text $q$);
