-- requires: number-theory, integer_factorizations, square_free_numbers, prime_power_numbers, semiprime_numbers, k_almost_primes
-- Number-theoretic gradings (GitHub #48) — the four classical shape constraints on a natural's prime-exponent
-- (p-adic) vector, as living reconciliation assertions. The math is ALREADY BUILT in the files above; each grading
-- exists in up to three views that must never drift:
--   Ω            factors_count(integer_factorization) ≡ big_omega(numeric)                — factors WITH multiplicity
--   ω            distinct_factors_count(integer_factorization) ≡ little_omega(numeric)    — DISTINCT primes
--   square-free  is_square_free(f) ⇔ Ω=ω (no exponent > 1) ⇔ n ∈ square_free_numbers
--   prime-power  is_prime_power(f) ⇔ ω=1 (one distinct prime) ⇔ n ∈ prime_power_numbers
-- This suite is the reconciliation made checkable: the carrier predicate, the numeric stat, and the realized
-- collection agree by construction, so we ASSERT it rather than re-deriving any of them (no new functions — that
-- would duplicate). Ω=2 (semiprimes) is included as the k_almost_primes(k) / semiprime_numbers cross-check.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  -- ── the two count gradings: carrier view ≡ numeric view ───────────────────────────────────────────────────
  ('number-gradings', 'Ω / ω: the carrier stats match big_omega / little_omega', 'ok', NULL,
   'factors_count ≡ big_omega and distinct_factors_count ≡ little_omega over 1..300.', $q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 1..300 LOOP
        ASSERT factors_count(factored(n)) = big_omega(n), 'Omega @'||n;
        ASSERT distinct_factors_count(factored(n)) = little_omega(n), 'omega @'||n;
      END LOOP;
    END $$
  $q$),

  ('number-gradings', 'Ω and ω known values: Ω(360)=6, ω(360)=3', 'eq', '6 3', '360 = 2^3·3^2·5.', $q$
    SELECT big_omega(360)::text || ' ' || little_omega(360)::text
  $q$),

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
