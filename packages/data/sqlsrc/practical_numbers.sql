-- requires: number-theory, realizer
-- practical_numbers (A005153), ported from pg-enumeratio-core_old_backup/sqlsrc/practical-numbers.sql.
-- A positive integer n is practical iff every integer m with 1 ≤ m ≤ n is a sum of distinct divisors of n.
-- Sierpiński/Stewart criterion (avoids brute subset-sum): n = 1, or n is even and, listing its prime-power
-- factors p_i^a_i with primes ascending, each p_i ≤ 1 + σ(P) where P = p_1^a_1·…·p_{i-1}^a_{i-1} (σ = divisor
-- sum; σ(1) = 1 for the empty prefix). A consequence: every practical number > 1 is even. Reuses factorize(n)
-- from 45-number-theory.sql (ascending parallel primes/powers arrays); the prefix σ is accumulated as
-- ∏ σ(p_i^a_i) with σ(p^a) = (p^(a+1) − 1)/(p − 1).
-- An ungraded / infinite number SET (carrier numeric), sibling of abundant/harshad/prime numbers: membership
-- IS the predicate is_practical, so `n <@ practical_numbers()` works; the floor scans ℕ keeping the practical
-- ones ascending.
--   6 = 2·3   even; p=2 ≤ 1+σ(1)=2, then p=3 ≤ 1+σ(2)=4 → practical ✓
--   10 = 2·5  even; p=2 ≤ 2, then p=5 > 1+σ(2)=4 → 4 is unrepresentable, NOT practical ✗

CREATE FUNCTION is_practical(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    f factorization;
    ps numeric[]; xs int[];
    prefix numeric := 1;   -- σ of the product of the prime powers seen so far; σ(1) = 1
    p numeric; a int; i int;
  BEGIN
    IF n < 1 THEN RETURN false; END IF;
    IF n = 1 THEN RETURN true; END IF;
    IF mod(n, 2) <> 0 THEN RETURN false; END IF;   -- every practical > 1 is even
    f := factorize(n);
    ps := f.primes; xs := f.powers;
    FOR i IN 1 .. coalesce(array_length(ps, 1), 0) LOOP
      p := ps[i]; a := xs[i];
      IF p > prefix + 1 THEN RETURN false; END IF;             -- Sierpiński gap: p too large to fill 1..σ(P)+p−1
      prefix := prefix * div(p ^ (a + 1) - 1, p - 1);          -- ×σ(p^a) = (p^(a+1)−1)/(p−1), exact
    END LOOP;
    RETURN true;
  END
$$;

CREATE TYPE practical_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f practical_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  -- practical numbers are fairly dense near the start (14 of the first 36 naturals); the +60 floor keeps tiny
  -- windows from underflowing
  SELECT n::numeric FROM generate_series(1, element_limit * 6 + 60) n WHERE is_practical(n::numeric) ORDER BY n LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f practical_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_practical(v) $$;

INSERT INTO base_collection VALUES ('practical_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f practical_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Prac' $$;   -- corpus symbol
SELECT base_realize('practical_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('practical_numbers', 'first fourteen via the realized floor', 'eq', '1,2,4,6,8,12,16,18,20,24,28,30,32,36',
   'A005153 — every m ≤ n is a sum of distinct divisors of n, ascending.', $q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(practical_numbers(), 14) e $q$),

  ('practical_numbers', 'ungraded ⇒ one fiber with empty address', 'eq', '1|{}', 'fibers(handle)', $q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(practical_numbers()) f LIMIT 1)
    FROM fibers(practical_numbers()) $q$),

  ('practical_numbers', 'unrank(6) = 16 (the 7th practical)', 'eq', '16', 'rank 6 (0-based)', $q$
    SELECT (unrank(practical_numbers(), 6)).value::text $q$),

  ('practical_numbers', 'cardinality = infinity', 'eq', 'Infinity', 'unbounded', $q$
    SELECT cardinality(practical_numbers())::text $q$),

  ('practical_numbers', 'contains via <@: 1 ∈ (by convention), 10 ∉ (2·5, 5 > 1+σ(2)=4)', 'eq', 'true|false',
   'is_practical', $q$
    SELECT (1::numeric <@ practical_numbers())::text || '|' || (10::numeric <@ practical_numbers())::text $q$),

  ('practical_numbers', 'each term satisfies the defining property', 'ok', NULL,
   'For every enumerated term, is_practical holds and every m in 1..n is a subset-sum of the divisors of n
    (brute 0/1-knapsack cross-check of the Sierpiński shortcut).', $q$
    DO $do$
    DECLARE r int; n int; m int; d int; s int; reach boolean[];
    BEGIN
      FOR r IN 0 .. 13 LOOP
        n := (unrank(practical_numbers(), r)).value::int;
        ASSERT is_practical(n), 'not practical @' || n;
        reach := array_fill(false, ARRAY[n + 1]);
        reach[1] := true;                          -- sum 0 reachable (index = sum + 1)
        FOR d IN 1 .. n LOOP
          IF mod(n, d) = 0 THEN
            FOR s IN REVERSE n .. d LOOP
              IF reach[s - d + 1] THEN reach[s + 1] := true; END IF;
            END LOOP;
          END IF;
        END LOOP;
        FOR m IN 1 .. n LOOP
          ASSERT reach[m + 1], m || ' unreachable for n=' || n;
        END LOOP;
      END LOOP;
    END $do$
  $q$),

  ('practical_numbers', 'count below 37 agrees with the anchor', 'eq', '14',
   '1,2,4,6,8,12,16,18,20,24,28,30,32,36 are the fourteen practical numbers strictly below 37.', $q$
    SELECT count(*)::text FROM generate_series(1, 36) n WHERE is_practical(n::numeric) $q$);
