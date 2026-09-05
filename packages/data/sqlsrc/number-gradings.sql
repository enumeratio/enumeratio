-- requires: number-theory, integer_factorizations
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
--
-- The square-free / prime-power / semiprime reconciliations (predicate ⇔ membership in the REALIZED collection)
-- need square_free_numbers / prime_power_numbers / semiprime_numbers / k_almost_primes — all number-sets — so
-- those examples live in packs/number-sets/number-gradings.number-sets.sql. What stays here (Ω/ω vs the carrier
-- stats) is pure core: factored/big_omega/little_omega, no realized collection involved.

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
  $q$);
