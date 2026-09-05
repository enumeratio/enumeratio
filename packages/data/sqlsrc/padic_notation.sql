-- requires: radix_notation, natural_numbers, utilities
-- padic_notation — the b-adic / p-adic representation of a natural number for a base b ≥ 2 (prime p gives the
-- p-adics ℚ_p / ℤ_p; composite b the b-adics, ℤ_b ≅ ∏_{p|b} ℤ_p by CRT). Ports the finite (non-negative) shadow
-- of the precursor's src/badic.ts, closing the 2-adic / 10-adic gap of enumeratio #155.
--
-- Convention here: digits are LSB-FIRST (…d₂d₁d₀ spelled left-to-right as d₀,d₁,d₂,…) — the p-adic reading where
-- position i is weighted bⁱ and high powers are b-adically small. badic.ts's badicWindow is MSB-first within the
-- window, so the goldens below reverse it; the two agree under reversal (pinned on examples.ts's cases).
--
-- Naturals have FINITE expansions (0-padded on the left/infinity side), so no window is needed: padic_digits is
-- the exact expansion, and the base_repr renderers never run out of window. The left-infinite direction —
-- negatives (…(b−1) = −1; below only the finite shadow n = value mod bᵏ), coprime-denominator rationals
-- (badicRational's eventually-periodic expansion, e.g. 1/3 = …01‾1₂), non-integral b-adics — is DEFERRED.
--
-- v_p(0) = +∞ by convention: the p-adic VALUATION returns the numeric 'Infinity' sentinel (Postgres numerics
-- have one); test `padic_valuation(0, p) = 'Infinity'::numeric` or `… > 1e308`.
--
-- Render format (base_repr): the LSB-first digit tuple comma-joined in parens, then the base in brackets —
-- 13 in the 2-adics renders `(1,0,1,1)[2]` (d₀=1, d₁=0, d₂=1, d₃=1; read right-to-left for the usual 1101₂).
-- Chosen over dense glyphs because LSB-first dense strings collide with MSB-first positional readings.
--
-- Deferred: negative integers' left-infinite expansion, rationals p/q with gcd(q,b)=1 (badicRational), p-adic
-- arithmetic/lifting, and ℤ_b as a realized collection (element = integer-or-unit-rational value, badicFamily).

-- ── core: LSB-first digit extraction / reconstruction ────────────────────────────────────────────────────────
-- The base-b digits of n, LSB-first (dᵢ is the bⁱ place): the radix engine's MSB-first extract reversed.
-- n = 0 floors to the single digit {0} (radix_extract's floor). Requires p ≥ 2 (carried by radix_extract);
-- negatives / fractions are the left-infinite direction → NULL (deferred, see header).
CREATE FUNCTION padic_digits(n numeric, p int) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n < 0 OR n <> trunc(n) THEN NULL
              ELSE ARRAY(SELECT d FROM unnest(radix_extract(n, p, 0, 1)) WITH ORDINALITY AS t(d, o) ORDER BY o DESC)
         END $$;

-- Reconstruct n from LSB-first digits: Σ dᵢ·pⁱ (i 0-based). Digits must lie in {0…p−1}; empty tuple → 0.
CREATE FUNCTION padic_value(digits int[], p int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric := 0; w numeric := 1; d int;
BEGIN
  IF p < 2 THEN RAISE EXCEPTION 'base must be ≥ 2, got %', p; END IF;
  FOREACH d IN ARRAY digits LOOP
    IF d < 0 OR d >= p THEN RAISE EXCEPTION 'digit % out of range for base %', d, p; END IF;
    v := v + d * w;
    w := w * p;
  END LOOP;
  RETURN v;
END $$;

-- vₚ(n) = exponent of the highest power of p dividing n = count of trailing zeros in the LSB-first expansion.
-- vₚ(0) = +∞ by convention, returned as the numeric 'Infinity' sentinel; vₚ(n) = 0 ⇔ p ∤ n (e.g. n odd, p = 2).
CREATE FUNCTION padic_valuation(n numeric, p int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE x numeric := n; v numeric := 0;
BEGIN
  IF p < 2 THEN RAISE EXCEPTION 'base must be ≥ 2, got %', p; END IF;
  IF n < 0 OR n <> trunc(n) THEN RETURN NULL; END IF;      -- naturals only; ℤ deferred
  IF x = 0 THEN RETURN 'Infinity'::numeric; END IF;        -- vₚ(0) = +∞ (sentinel, see header)
  WHILE x % p = 0 LOOP
    v := v + 1;
    x := div(x, p);
  END LOOP;
  RETURN v;
END $$;

-- ── optional: p-adic absolute value |n|ₚ = p^(−vₚ(n)), rendered as a rational ────────────────────────────────
-- |0|ₚ = 0; |n|ₚ = 1 ⇔ p ∤ n (n a p-adic unit); else the unit fraction 1/pᵛ. Text, not numeric: keeps exactness.
CREATE FUNCTION padic_norm(n numeric, p int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL OR n < 0 OR n <> trunc(n) THEN NULL
              WHEN n = 0 THEN '0'
              WHEN padic_valuation(n, p) = 0 THEN '1'
              ELSE '1/' || pow_int(p, padic_valuation(n, p)::int)::text
         END $$;

-- ── the unary render_fns registered in base_repr (carrier numeric; NULL/fraction/negative → NULL) ────────────
-- LSB-first tuple + [base] suffix (see header). For a natural the expansion is finite exact — no window, so the
-- only NULL is the NULL/negative/fraction guard (out of the natural domain, like to_roman).
CREATE FUNCTION padic_render(digits int[], p int) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string(digits, ',') || ')[' || p || ']' $$;

CREATE FUNCTION to_padic_2(n numeric)  RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL THEN NULL ELSE padic_render(padic_digits(n, 2), 2) END $$;

CREATE FUNCTION to_padic_10(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n IS NULL THEN NULL ELSE padic_render(padic_digits(n, 10), 10) END $$;

-- ── register base_repr rows ─────────────────────────────────────────────────────────────────────────────────
-- The two examples.ts / #155 cases: the 2-adics (prime) and the 10-adics (composite, ℤ₁₀ ≅ ℤ₂ × ℤ₅).
-- ℕ-only presentations, neither canonical (decimal is).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('natural_numbers','2-adic', 'to_padic_2', '2-adic (p-adic digits, LSB-first)',   false),
  ('natural_numbers','10-adic','to_padic_10','10-adic (b-adic digits, LSB-first)',  false);


-- ── examples (pinned to the precursor's examples.ts badic group + hand-computed valuations) ─────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('padic_notation','13 in the 2-adics — digits LSB-first (1,0,1,1)','eq','1,0,1,1','examples.ts: badicWindow(13,2,4) = [1,1,0,1] MSB-first; reversed here (13 = 1101₂)',$q$
    SELECT array_to_string(padic_digits(13, 2), ',') $q$),
  ('padic_notation','finite shadow of −1 in the 2-adics: 63 = 2⁶−1 → six 1s','eq','1,1,1,1,1,1','examples.ts: badicWindow(-1,2,6) = [1,1,1,1,1,1] — the natural 2⁶−1 shares −1''s 6-place window (…111111₂ mod 2⁶)',$q$
    SELECT array_to_string(padic_digits(63, 2), ',') $q$),
  ('padic_notation','finite shadow of −1 in the 10-adics: 9999 → (9,9,9,9)','eq','9,9,9,9','examples.ts: badicWindow(-1,10,4) = [9,9,9,9] — LSB/MSB agree on a constant word (…9999₁₀ mod 10⁴)',$q$
    SELECT array_to_string(padic_digits(9999, 10), ',') $q$),
  ('padic_notation','finite shadow of −5 in the 10-adics: 999995, LSB-first (5,9,9,9,9,9)','eq','5,9,9,9,9,9','examples.ts: badicWindow(-5,10,6) is [9,9,9,9,9,5] MSB-first = −5 mod 10⁶ = 999995; reversed here',$q$
    SELECT array_to_string(padic_digits(999995, 10), ',') $q$),
  ('padic_notation','reconstruction: value of LSB-first (1,0,1,1) base 2 is 13; empty tuple → 0','eq','13|0','padic_value = Σ dᵢ·pⁱ = 1 + 0·2 + 1·4 + 1·8',$q$
    SELECT padic_value(ARRAY[1,0,1,1], 2)::text || '|' || padic_value('{}', 2)::text $q$),
  ('padic_notation','round-trip: value(digits(n,2)) = n for n = 0..63','eq','true','padic_value ∘ padic_digits = id on a full 6-bit window',$q$
    SELECT bool_and(padic_value(padic_digits(n, 2), 2) = n)::text FROM generate_series(0, 63) n $q$),
  ('padic_notation','round-trip: value(digits(n,10)) = n for n = 0..99','eq','true','the 10-adic expansion of a natural is finite exact',$q$
    SELECT bool_and(padic_value(padic_digits(n, 10), 10) = n)::text FROM generate_series(0, 99) n $q$),
  ('padic_notation','0 floors to the single digit {0}','eq','0','radix_extract''s floor: one zero digit, not the empty word',$q$
    SELECT (padic_digits(0, 10))[1]::text $q$),
  ('padic_notation','valuations: v₂(8) = 3, v₂(12) = 2, v₃(18) = 2, v₂(odd) = 0','eq','3|2|2|0','vₚ(n) = exponent of the highest power of p dividing n = trailing LSB-first zeros; 12 = 2²·3, 18 = 3²·2, 7 odd',$q$
    SELECT padic_valuation(8, 2)::text || '|' || padic_valuation(12, 2)::text || '|' ||
           padic_valuation(18, 3)::text || '|' || padic_valuation(7, 2)::text $q$),
  ('padic_notation','v₂(0) = +∞ — the numeric Infinity sentinel','eq','Infinity','by convention 0 is divisible by every power of p; sentinel documented in the file header',$q$
    SELECT padic_valuation(0, 2)::text $q$),
  ('padic_notation','p-adic norm: |12|₂ = 1/4, |7|₂ = 1, |0|₂ = 0','eq','1/4|1|0','|n|ₚ = p^(−vₚ(n)) rendered as a rational — smaller when more divisible (the p-adic topology)',$q$
    SELECT padic_norm(12, 2) || '|' || padic_norm(7, 2) || '|' || padic_norm(0, 2) $q$),
  ('padic_notation','guards: digit out of range, base < 2 raise; negative / fractional n → NULL','eq','true|true|true|true','digits must lie in {0…p−1}; the left-infinite direction (negatives, fractions) is deferred, signalled by NULL',$q$
    SELECT base_raises($e$ SELECT padic_value(ARRAY[2], 2) $e$)::text || '|' ||
           base_raises($e$ SELECT padic_digits(5, 1) $e$)::text || '|' ||
           (padic_digits(-1, 2) IS NULL)::text || '|' || (padic_digits(2.5, 2) IS NULL)::text $q$),
  ('padic_notation','base_repr: 13 renders (1,0,1,1)[2], 12345 renders (5,4,3,2,1)[10]','eq','(1,0,1,1)[2]|(5,4,3,2,1)[10]','LSB-first comma tuple + [base] suffix — read right-to-left for the familiar 1101₂ / 12345₁₀',$q$
    SELECT to_padic_2(13) || '|' || to_padic_10(12345) $q$),
  ('padic_notation','naturals carry the 2-adic and 10-adic presentations; neither canonical','eq','10-adic|2-adic|true','base_repr rows on natural_numbers; decimal stays the canonical repr',$q$
    SELECT string_agg(repr, '|' ORDER BY repr) || '|' || bool_and(NOT canonical)::text
    FROM base_repr WHERE collection = 'natural_numbers' AND repr IN ('2-adic', '10-adic') $q$);


