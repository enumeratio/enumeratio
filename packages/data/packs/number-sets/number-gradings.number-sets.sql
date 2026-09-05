-- requires: number-gradings, square_free_numbers, prime_power_numbers, semiprime_numbers, k_almost_primes
-- number-sets half of sqlsrc/number-gradings.sql (#283 phase 3 extraction) — the reconciliations that assert
-- predicate ⇔ membership in a REALIZED number-sets collection (core's file keeps the Ω/ω carrier-vs-numeric-stat
-- checks, which involve no realized collection at all).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  -- ── square-free: predicate ⇔ Ω=ω ⇔ membership ─────────────────────────────────────────────────────────────
  ('number-gradings', 'square-free: is_square_free ⇔ Ω=ω ⇔ ∈ square_free_numbers', 'ok', NULL,
   'all exponents ≤ 1 ⇔ Ω(n)=ω(n) ⇔ realized membership, over 1..300.', $q$
    DO $$ DECLARE n int; sf boolean; BEGIN
      FOR n IN 1..300 LOOP
        sf := is_square_free(factored(n));
        ASSERT sf = (big_omega(n) = little_omega(n)), 'sf=Omega=omega @'||n;
        ASSERT sf = (n::numeric <@ square_free_numbers()), 'sf=member @'||n;
      END LOOP;
    END $$
  $q$),

  ('number-gradings', 'square-free known values: 30 free, 12 not', 'eq', 'true false', '30 = 2·3·5 (all e=1); 12 = 2^2·3.', $q$
    SELECT is_square_free(factored(30))::text || ' ' || is_square_free(factored(12))::text
  $q$),

  -- ── prime-power: predicate ⇔ ω=1 ⇔ membership ─────────────────────────────────────────────────────────────
  ('number-gradings', 'prime-power: is_prime_power ⇔ ω=1 ⇔ ∈ prime_power_numbers', 'ok', NULL,
   'exactly one distinct prime ⇔ ω(n)=1 ⇔ realized membership, over 2..300.', $q$
    DO $$ DECLARE n int; pp boolean; BEGIN
      FOR n IN 2..300 LOOP
        pp := is_prime_power(factored(n));
        ASSERT pp = (little_omega(n) = 1), 'pp=omega1 @'||n;
        ASSERT pp = (n::numeric <@ prime_power_numbers()), 'pp=member @'||n;
      END LOOP;
    END $$
  $q$),

  ('number-gradings', 'prime-power known values: 8 is, 12 is not', 'eq', 'true false', '8 = 2^3 (ω=1); 12 = 2^2·3 (ω=2).', $q$
    SELECT is_prime_power(factored(8))::text || ' ' || is_prime_power(factored(12))::text
  $q$),

  -- ── Ω=2 (semiprimes): the graded k_almost_primes(k) point agrees with the standalone collection + predicate ─
  ('number-gradings', 'Ω=2: is_semiprime ⇔ ∈ semiprime_numbers ⇔ ∈ k_almost_primes(2)', 'ok', NULL,
   'the Ω=2 slice is one grading seen three ways, over 1..300.', $q$
    DO $$ DECLARE n int; sp boolean; BEGIN
      FOR n IN 1..300 LOOP
        sp := is_semiprime(factored(n));
        ASSERT sp = (big_omega(n) = 2), 'sp=Omega2 @'||n;
        ASSERT sp = (n::numeric <@ semiprime_numbers()), 'sp=member @'||n;
        ASSERT sp = (n::numeric <@ k_almost_primes(2)), 'sp=kalmost2 @'||n;
      END LOOP;
    END $$
  $q$);
