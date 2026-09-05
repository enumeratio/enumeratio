-- requires: integer_factorizations
-- number-predicates — the classical number-theoretic shape constraints as NAMED numeric predicates, each a thin
-- delegate to the FACTORED carrier's exponent-vector reads (is_square_free/is_prime_power/is_semiprime on
-- integer_factorization). This is the hybrid home: the collections below stay numeric (base_restrict children of
-- natural_numbers), but the predicate logic lives ONCE — on the factorization — so the numeric view and the
-- factored view can never drift (number-gradings asserts exactly that). The only thing added over the factored
-- predicate is the natural-number domain guard (n ≥ 1 or ≥ 2, matching the sets' least element).

CREATE FUNCTION is_square_free_number(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n >= 1 AND n = trunc(n) AND is_square_free(factored(n)) $$;                 -- Ω=ω, 1 counts
CREATE FUNCTION is_prime_power_number(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n >= 2 AND is_prime_power(factored(n)) $$;                                  -- ω=1 (one distinct prime)
CREATE FUNCTION is_semiprime_number(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n >= 1 AND n = trunc(n) AND is_semiprime(factored(n)) $$;                   -- Ω=2
CREATE FUNCTION is_squarefree_semiprime(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_semiprime_number(n) AND is_square_free(factored(n)) $$;                  -- Ω=2 ∧ ω=2 (distinct primes)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('number-predicates','the numeric delegators match the factored predicate over 1..300','ok',NULL,
   'is_*_number(n) ≡ is_*(factored(n)) (plus the domain guard) — one source of truth, the exponent vector.',$q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 1..300 LOOP
        ASSERT is_square_free_number(n)  = (n >= 1 AND is_square_free(factored(n))),  'sf @'||n;
        ASSERT is_prime_power_number(n)  = (n >= 2 AND is_prime_power(factored(n))), 'pp @'||n;
        ASSERT is_semiprime_number(n)    = is_semiprime(factored(n)),                 'sp @'||n;
        ASSERT is_squarefree_semiprime(n)= (is_semiprime(factored(n)) AND is_square_free(factored(n))), 'qfsp @'||n;
      END LOOP;
    END $$ $q$),
  ('number-predicates','known shapes: 30 free, 12 not; 8 prime-power, 12 not; 15 semiprime, 8 not','eq','true false true false true false',
   '30=2·3·5, 12=2²·3, 8=2³ (ω=1), 15=3·5 (Ω=2), 8 (Ω=3)',$q$
    SELECT is_square_free_number(30)::text||' '||is_square_free_number(12)::text||' '||
           is_prime_power_number(8)::text ||' '||is_prime_power_number(12)::text||' '||
           is_semiprime_number(15)::text  ||' '||is_semiprime_number(8)::text $q$);
