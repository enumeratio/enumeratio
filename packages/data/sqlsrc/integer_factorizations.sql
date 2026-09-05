-- requires: number-theory, realizer
-- integer_factorizations — ported from pg-enumeratio-core_old_backup/sqlsrc/factored-integer-number.sql.
-- An integer represented by its factorization: a sign bit + parallel arrays of prime bases and positive
-- exponents (PG has no typed map; parallel arrays are the house idiom). sign is a SIGN BIT: false ⇒ +,
-- true ⇒ − (unit = (−1)^sign). NULL arrays ⇒ 0; empty arrays ⇒ ±1. 0's sign bit is always unset (no "−0").
-- factored(n) ⇄ value(f) is the bijection ℤ ↔ factorizations. Reuses factorize/factorization (45-number-theory)
-- for the magnitude's prime/power arrays — only the sign wraps around it. The realized collection walks ℤ⁺
-- (rank r ↦ r+1); the carrier also models 0 and negatives (ungraded/unbounded, like prime_numbers).
--
-- The old-backup source modeled this as a CHECKed DOMAIN over an unchecked base composite; the new architecture
-- has no domains, so integer_factorization is a plain composite carrier (well-formedness holds by construction
-- — factored() is the only producer). Its p-adic prime_rank_vector projection is dropped: it depended on
-- prime_rank()/prime_exponents(), neither of which exists in this architecture.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE integer_factorization AS (sign boolean, primes numeric[], powers int[]);

-- ── the bijection: factored(n) ⇄ value(f) ───────────────────────────────────────────────────────────────
CREATE FUNCTION factored(n numeric) RETURNS integer_factorization LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric := trunc(n); fz factorization;
  BEGIN
    IF n <> trunc(n) THEN RETURN NULL; END IF;
    IF m = 0 THEN RETURN ROW(false, NULL, NULL)::integer_factorization; END IF;   -- 0: null arrays, sign bit unset
    fz := factorize(abs(m));                                                       -- reuse: primes/powers of |n|
    RETURN ROW(m < 0, (fz).primes, (fz).powers)::integer_factorization;          -- sign bit set iff negative
  END $$;

CREATE FUNCTION value(f integer_factorization) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric := 1; i int;
  BEGIN
    IF (f).primes IS NULL THEN RETURN 0; END IF;
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP r := r * ((f).primes[i] ^ (f).powers[i]); END LOOP;
    RETURN trunc(r) * (CASE WHEN (f).sign THEN -1 ELSE 1 END);
  END $$;

CREATE FUNCTION unit(f integer_factorization) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).sign THEN -1 ELSE 1 END $$;                                 -- (−1)^sign

-- ── the multiplicative stats (zip the two arrays; on the magnitude — sign-agnostic) ───────────────────────
CREATE FUNCTION factors(f integer_factorization) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_agg((f).primes[i] ORDER BY (f).primes[i])                           -- multiset
  FROM generate_series(1, coalesce(array_length((f).primes, 1), 0)) i CROSS JOIN generate_series(1, (f).powers[i])
$$;

CREATE FUNCTION factors_count(f integer_factorization) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(x), 0) FROM unnest((f).powers) x                             -- Ω
$$;

CREATE FUNCTION distinct_factors(f integer_factorization) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (f).primes                                                                -- the set of primes
$$;

CREATE FUNCTION distinct_factors_count(f integer_factorization) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((f).primes, 1), 0)                                  -- ω
$$;

CREATE FUNCTION divisors(f integer_factorization) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE divs numeric[] := ARRAY[1::numeric]; nd numeric[]; i int; k int; pk numeric; d numeric;   -- all divisors, sorted
  BEGIN
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP
      nd := '{}';
      FOR k IN 0 .. (f).powers[i] LOOP
        pk := trunc((f).primes[i] ^ k);
        FOREACH d IN ARRAY divs LOOP nd := nd || trunc(d * pk); END LOOP;
      END LOOP;
      divs := nd;
    END LOOP;
    RETURN array(SELECT v FROM unnest(divs) v ORDER BY v);
  END $$;

CREATE FUNCTION divisors_count(f integer_factorization) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE x int; r numeric := 1; BEGIN FOREACH x IN ARRAY coalesce((f).powers, '{}') LOOP r := r * (x + 1); END LOOP; RETURN r; END   -- σ₀ = ∏(eᵢ+1)
$$;

CREATE FUNCTION divisors_sum(f integer_factorization) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric := 1; i int; BEGIN                                             -- σ₁ = ∏ (pᵉ⁺¹−1)/(p−1)
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP
      r := r * div(trunc((f).primes[i] ^ ((f).powers[i] + 1)) - 1, (f).primes[i] - 1);
    END LOOP; RETURN r; END
$$;

-- ── the factoring-dependent predicates (cheap reads) ────────────────────────────────────────────────────
CREATE FUNCTION is_prime_power(f integer_factorization) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((f).primes, 1) = 1, false)                          -- ω = 1 (empty/NULL primes → 0 or 1, not a prime power)
$$;

CREATE FUNCTION is_square_free(f integer_factorization) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 > ALL (coalesce((f).powers, '{}'))                                      -- every exponent = 1
$$;

CREATE FUNCTION is_semiprime(f integer_factorization) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT factors_count(f) = 2                                                      -- Ω = 2
$$;

-- ── exponent-vector arithmetic: nth_power scales exponents (×k); n = ±s²·q stores (√s², q) ─────────────────
CREATE FUNCTION nth_power(f integer_factorization, k int) RETURNS integer_factorization LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE xs int[] := '{}'; i int;                                                 -- value(nth_power(f,k)) = value(f)^k
  BEGIN
    IF (f).primes IS NULL THEN RETURN factored(0); END IF;                         -- 0^k = 0
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP xs := xs || ((f).powers[i] * k); END LOOP;
    RETURN ROW((f).sign AND mod(k, 2) = 1, (f).primes, xs)::integer_factorization;   -- sign survives only for odd k
  END $$;

-- n = unit(f) · square_part_root(f)² · square_free_part(f). The SQUARE part is stored as its root √(s²): exponents ÷2.
CREATE FUNCTION square_part_root(f integer_factorization) RETURNS integer_factorization LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ps numeric[] := '{}'; xs int[] := '{}'; i int;
  BEGIN
    IF (f).primes IS NULL THEN RETURN factored(0); END IF;
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP
      IF (f).powers[i] >= 2 THEN ps := ps || (f).primes[i]; xs := xs || div((f).powers[i]::numeric, 2)::int; END IF;   -- ⌊e/2⌋
    END LOOP;
    RETURN ROW(false, ps, xs)::integer_factorization;                            -- positive: s in n = ±s²·q
  END $$;

CREATE FUNCTION square_free_part(f integer_factorization) RETURNS integer_factorization LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ps numeric[] := '{}'; xs int[] := '{}'; i int;
  BEGIN
    IF (f).primes IS NULL THEN RETURN factored(0); END IF;
    FOR i IN 1 .. coalesce(array_length((f).primes, 1), 0) LOOP
      IF mod((f).powers[i], 2) = 1 THEN ps := ps || (f).primes[i]; xs := xs || 1; END IF;   -- e mod 2 (the square-free kernel)
    END LOOP;
    RETURN ROW(false, ps, xs)::integer_factorization;                            -- positive, square-free: q
  END $$;

-- σ(n) − n and σ(n) − 2n: the aliquot sum and the abundance (perfect = 0, abundant > 0, deficient < 0).
CREATE FUNCTION aliquot_sum(f integer_factorization) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT divisors_sum(f) - value(f) $$;
CREATE FUNCTION abundance(f integer_factorization) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT divisors_sum(f) - 2 * value(f) $$;

CREATE FUNCTION notation(f integer_factorization) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).primes IS NULL THEN '0' ELSE (CASE WHEN (f).sign THEN '-' ELSE '' END) ||
    coalesce((SELECT string_agg(CASE WHEN (f).powers[i] = 1 THEN (f).primes[i]::text ELSE (f).primes[i]::text || '^' || (f).powers[i] END, '·' ORDER BY (f).primes[i])
             FROM generate_series(1, array_length((f).primes, 1)) i), '1') END
$$;

-- ── register as a collection: integer_factorizations, ordered ascending by value over ℤ⁺ ──────────────
-- (rank r, 0-based) ↦ (r+1)-th positive integer; the carrier also holds 0/negatives but the walk is ℤ⁺, so
-- ungraded + unbounded, like prime_numbers.
CREATE TYPE integer_factorizations_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f integer_factorizations_fiber, element_limit int) RETURNS SETOF integer_factorization LANGUAGE sql STABLE AS $$
  SELECT factored(r + 1) FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION contains_in_fiber(f integer_factorizations_fiber, v integer_factorization) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT value(v) >= 1 $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f integer_factorizations_fiber, rank rank_index) RETURNS integer_factorization LANGUAGE sql IMMUTABLE AS $fu$ SELECT factored(rank + 1) $fu$;
INSERT INTO base_collection VALUES ('integer_factorizations', 'integer_factorization', true);   -- unbounded, ungraded
SELECT base_realize('integer_factorizations');

-- ── catalog: the multiplicative stats + the ±s²·q maps ─────────────────────────────────────────────────────
-- value_fns over the composite carrier, so base_stat_resolved surfaces them on integer_factorizations (numeric
-- scalar carriers never carrier-inherit). σ_k for k>1 stays a plain function — a map's mapping_fn is unary.
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('integer_factorizations','big_omega','factors_count','Ω — prime factors with multiplicity','natural_numbers'),
  ('integer_factorizations','little_omega','distinct_factors_count','ω — distinct prime factors','natural_numbers'),
  ('integer_factorizations','divisor_count','divisors_count','τ = σ₀ — number of divisors','natural_numbers'),
  ('integer_factorizations','divisor_sum','divisors_sum','σ = σ₁ — sum of divisors','natural_numbers'),
  ('integer_factorizations','aliquot_sum','aliquot_sum','s(n) = σ(n) − n — the aliquot sum','natural_numbers'),
  ('integer_factorizations','abundance','abundance','σ(n) − 2n — perfect = 0, abundant > 0, deficient < 0','integer_numbers');
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('integer_factorizations','square_free_part','square_free_part','integer_factorizations','q in n = ±s²·q — the square-free kernel',NULL),
  ('integer_factorizations','square_part_root','square_part_root','integer_factorizations','s in n = ±s²·q — the root of the square part',NULL);

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('integer_factorizations', 'factored ⇄ value round-trips (signed, incl 0)', 'ok', NULL, 'The bijection ℤ ↔ factorizations, sign and 0 included.', $q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN -60..60 LOOP ASSERT value(factored(n)) = n, 'rt @'||n; END LOOP;
    END $$
  $q$),

  ('integer_factorizations', 'notation: signed', 'eq', '-2^3·3^2·5', '−360 = −(2³·3²·5).', $q$
    SELECT notation(factored(-360))
  $q$),

  ('integer_factorizations', 'notation: 0, 1, -1', 'eq', '0 1 -1', '0 = null arrays; ±1 = empty arrays.', $q$
    SELECT notation(factored(0)) || ' ' || notation(factored(1)) || ' ' || notation(factored(-1))
  $q$),

  ('integer_factorizations', 'Ω and ω', 'eq', '6 3', 'Ω(360)=6, ω(360)=3.', $q$
    SELECT factors_count(factored(360))::text || ' ' || distinct_factors_count(factored(360))::text
  $q$),

  ('integer_factorizations', 'factors multiset, distinct_factors set', 'eq', '{2,2,3} {2,3}', '12 = 2·2·3.', $q$
    SELECT factors(factored(12))::text || ' ' || distinct_factors(factored(12))::text
  $q$),

  ('integer_factorizations', 'divisors + σ₀ + σ₁', 'eq', '{1,2,3,4,6,12} 6 28', 'τ(12)=6, σ(12)=28.', $q$
    SELECT divisors(factored(12))::text || ' ' || divisors_count(factored(12))::text || ' ' || divisors_sum(factored(12))::text
  $q$),

  ('integer_factorizations', 'predicates are cheap reads', 'eq', 'truetruetrue', '8=2³, 30=2·3·5, 15=3·5.', $q$
    SELECT is_prime_power(factored(8))::text || is_square_free(factored(30))::text || is_semiprime(factored(15))::text
  $q$),

  ('integer_factorizations', 'the empty factorization of 1', 'eq', 'false true false', '1 has no primes: not a prime power, but square-free (vacuously), and not semiprime.', $q$
    SELECT is_prime_power(factored(1))::text || ' ' || is_square_free(factored(1))::text || ' ' || is_semiprime(factored(1))::text
  $q$),

  ('integer_factorizations', 'unit is (−1)^sign', 'eq', '1 -1 1', '+, −, and 0 (sign bit unset).', $q$
    SELECT unit(factored(6))::text || ' ' || unit(factored(-6))::text || ' ' || unit(factored(0))::text
  $q$),

  ('integer_factorizations', 'nth_power scales exponents', 'eq', '36 -8', '6²=36 (even k ⇒ +); (−2)³=−8 (odd k keeps the sign).', $q$
    SELECT value(nth_power(factored(6), 2))::text || ' ' || value(nth_power(factored(-2), 3))::text
  $q$),

  ('integer_factorizations', 'n = ±s²·q decomposition', 'eq', '2·3 2·5', '360 = 2³·3²·5 ⇒ s=√(square part)=2·3=6, q=2·5=10.', $q$
    SELECT notation(square_part_root(factored(360))) || ' ' || notation(square_free_part(factored(360)))
  $q$),

  ('integer_factorizations', 'the decomposition rebuilds n', 'ok', NULL, 's²·q = n over 1..120; the square-free part IS square-free.', $q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 1..120 LOOP ASSERT value(nth_power(square_part_root(factored(n)), 2)) * value(square_free_part(factored(n))) = n, 's2q @'||n; END LOOP;
    END $$
  $q$),

  ('integer_factorizations', 'the square-free part is square-free', 'ok', NULL, 'square_free_part lands in the square-free numbers.', $q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 1..120 LOOP ASSERT is_square_free(square_free_part(factored(n))), 'sf @'||n; END LOOP;
    END $$
  $q$),

  ('integer_factorizations', 'first ten via the realized floor (walks ℤ⁺)', 'eq', '1,2,3,4,5,6,7,8,9,10', 'elements over the ungraded fiber', $q$
    SELECT string_agg(value((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(integer_factorizations(), 10) e
  $q$),

  ('integer_factorizations', 'order-iso: rank r ↦ the (r+1)-th positive integer', 'ok', NULL, 'The sequence walks ℤ⁺; value is the inverse.', $q$
    DO $$ DECLARE r int; BEGIN
      FOR r IN 0..30 LOOP ASSERT value((unrank(integer_factorizations(), r)).value) = r + 1, 'iso @'||r; END LOOP;
    END $$
  $q$),

  ('integer_factorizations', 'cardinality = infinity (unbounded, walks all of ℤ⁺)', 'eq', 'Infinity', 'like prime_numbers', $q$
    SELECT cardinality(integer_factorizations())::text
  $q$),

  ('integer_factorizations', 'contains via <@: 12 ∈ ℤ⁺, 0 and -3 ∉', 'eq', 'true|false|false', 'the carrier also models 0/negatives; membership is ℤ⁺ only', $q$
    SELECT (factored(12) <@ integer_factorizations())::text || '|' ||
           (factored(0) <@ integer_factorizations())::text || '|' ||
           (factored(-3) <@ integer_factorizations())::text
  $q$),

  ('integer_factorizations', 'aliquot sums: 220 and 284 are amicable', 'eq', '284 220', 's(220)=284 and s(284)=220', $q$
    SELECT aliquot_sum(factored(220))::text || ' ' || aliquot_sum(factored(284))::text
  $q$),

  ('integer_factorizations', 'abundance classifies 6 (perfect), 12 (abundant), 8 (deficient)', 'eq', '0 4 -1', 'σ(n) − 2n', $q$
    SELECT abundance(factored(6))::text || ' ' || abundance(factored(12))::text || ' ' || abundance(factored(8))::text
  $q$),

  ('integer_factorizations', 'the registry lists at least the known integer_factorization stats + maps (a floor — more may be added)', 'eq', 'true|true', 'base_stat / base_map rows', $q$
    SELECT (SELECT array_agg(stat_id) @> ARRAY['abundance','aliquot_sum','big_omega','divisor_count','divisor_sum','little_omega'] FROM base_stat WHERE collection = 'integer_factorizations')::text || '|' ||
           (SELECT array_agg(map_id) @> ARRAY['square_free_part','square_part_root'] FROM base_map WHERE collection = 'integer_factorizations')::text
  $q$);
