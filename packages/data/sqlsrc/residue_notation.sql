-- requires: radix_notation, natural_numbers, number-theory, utilities
-- residue_notation — the residue (RNS) and flag (FNS) number systems: the within-digit CRT channels of ns.ts that
-- radix_notation.sql's header explicitly left un-ported. Ported from the precursor's src/scheme.ts (liftDigit /
-- liftDigitRNS / lowerDigit / lowerDigitCRT) and src/ns.ts (NS.FNS = ordered channels, NS.RNS = unordered), closing
-- enumeratio #155.
--
-- Both systems split one register window [0, M), M = ∏ mᵢ, over pairwise-coprime moduli (a prime power like 2² = 4
-- is one legal channel — the parts need only be PAIRWISE COPRIME, matching ns.ts's schemeFromModuli):
--   RNS (unordered, parallel channels, CRT, no carry):  residueᵢ = n mod mᵢ          (scheme.ts liftDigitRNS)
--   FNS (ordered, series channels, carry, flag):        residueᵢ = ⌊n / ∏_{j<i} m_j⌋ mod mᵢ   (scheme.ts liftDigit)
-- The element is the integer value in the window; the residue tuples are presentations of it. Channel tuples are
-- indexed in the moduli array order — for FNS m₀ is the units channel (LSB-first, liftDigit's convention). Same digit,
-- different systems: 1 in scheme (3,5) gives FNS (1,0) but RNS (1,1) — carry vs independence, pinned below.
--
-- Rendering (precursor convention): the digit tuple parenthesised, then the moduli spec — BRACED {m₀,…} for RNS,
-- PARENTHESISED (m₀,…) for FNS (examples.ts baseLabel: "constant bare, list/FNS parenthesised, RNS braced").
--
-- Deferred (not ported): alphabetic digit substitution and NS's `shift` (radix-point) / `unit` (negabase) axes —
-- negabase is a single-radix place-value flip that doesn't have an analogue over independent CRT channels. offset
-- and complement now live below as overloads of rns_/fns_digits/value (§ register axes); the general MRNS
-- prime-power channel sub-expansion (e.g. 4 = 2² → two base-2 positions) lives in mrns_digits/mrns_value (§ MRNS).

-- ── core: guards + CRT helpers ───────────────────────────────────────────────────────────────────────────────
-- Every public fn validates its moduli: non-empty, each ≥ 2, pairwise coprime (the CRT precondition).
CREATE FUNCTION residue_validate(moduli int[]) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE len int := coalesce(array_length(moduli, 1), 0); i int; j int;
BEGIN
  IF len = 0 THEN RAISE EXCEPTION 'moduli must be non-empty'; END IF;
  FOR i IN 1..len LOOP
    IF moduli[i] < 2 THEN RAISE EXCEPTION 'each modulus must be ≥ 2, got %', moduli; END IF;
    FOR j IN i + 1 .. len LOOP
      IF gcd_int(moduli[i], moduli[j]) <> 1 THEN
        RAISE EXCEPTION 'moduli must be pairwise coprime, got % (gcd(%, %) > 1)', moduli, moduli[i], moduli[j];
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- The register modulus M = ∏ mᵢ (numeric: counts get huge).
CREATE FUNCTION residue_modulus(moduli int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE p numeric := 1; m int;
BEGIN
  FOREACH m IN ARRAY moduli LOOP p := p * m; END LOOP;
  RETURN p;
END $$;

-- Modular inverse of a mod m (m ≥ 2, gcd(a, m) = 1), extended Euclid; a is taken mod m first (callers hand in
-- Mᵢ mod mᵢ with Mᵢ = M / mᵢ). Kept under the residue_ prefix so a future shared utility can't collide.
CREATE FUNCTION residue_invmod(a numeric, m int) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t numeric := 0; nt numeric := 1; r numeric := m; nr numeric := ((a % m) + m) % m; q numeric; tmp numeric;
BEGIN
  WHILE nr <> 0 LOOP
    q := div(r, nr);
    tmp := t - q * nt; t := nt; nt := tmp;
    tmp := r - q * nr; r := nr; nr := tmp;
  END LOOP;
  IF r <> 1 THEN RAISE EXCEPTION '% has no inverse mod % (not coprime)', a, m; END IF;
  RETURN (((t % m) + m) % m)::int;
END $$;

-- Window guard shared by both extractors: the element is the integer value in [0, M) — anything else RAISES
-- (the precursor's NS wraps cyclically; here the register window is a hard domain, per the #155 spec).
CREATE FUNCTION residue_window_check(n numeric, moduli int[]) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF n IS NULL OR n <> trunc(n) THEN RAISE EXCEPTION 'value must be an integer, got %', n; END IF;
  IF n < 0 OR n >= residue_modulus(moduli) THEN
    RAISE EXCEPTION 'value % outside the residue register window [0, %)', n, residue_modulus(moduli);
  END IF;
END $$;

-- Digit-tuple guard shared by both reconstructors: one residue per channel, each 0 ≤ dᵢ < mᵢ.
CREATE FUNCTION residue_digits_check(digits int[], moduli int[]) RETURNS void LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE len int := array_length(moduli, 1); i int;
BEGIN
  IF coalesce(array_length(digits, 1), 0) <> len THEN
    RAISE EXCEPTION 'need exactly % residues for moduli %, got %', len, moduli, digits;
  END IF;
  FOR i IN 1..len LOOP
    IF digits[i] < 0 OR digits[i] >= moduli[i] THEN
      RAISE EXCEPTION 'residue % out of range for modulus %', digits[i], moduli[i];
    END IF;
  END LOOP;
END $$;

-- ── RNS — residue number system (unordered CRT channels, no carry) ───────────────────────────────────────────
-- rns_digits: per-channel residue n mod mᵢ (scheme.ts liftDigitRNS, offset 0).
CREATE FUNCTION rns_digits(n numeric, moduli int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  PERFORM residue_validate(moduli);
  PERFORM residue_window_check(n, moduli);
  RETURN ARRAY(SELECT (n % moduli[i])::int FROM generate_series(1, array_length(moduli, 1)) AS g(i) ORDER BY i);
END $$;

-- rns_value: CRT reconstruction, unique in [0, M) (scheme.ts lowerDigitCRT):
--   v = Σᵢ dᵢ · Mᵢ · (Mᵢ⁻¹ mod mᵢ)  mod M,   Mᵢ = M / mᵢ.
CREATE FUNCTION rns_value(digits int[], moduli int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m numeric; mi numeric; v numeric := 0; i int; len int;
BEGIN
  PERFORM residue_validate(moduli);
  PERFORM residue_digits_check(digits, moduli);
  m := residue_modulus(moduli); len := array_length(moduli, 1);
  FOR i IN 1..len LOOP
    mi := div(m, moduli[i]);
    v := v + digits[i] * mi * residue_invmod(mi % moduli[i], moduli[i]);
  END LOOP;
  RETURN v % m;
END $$;

-- ── register axes: offset + complement ──────────────────────────────────────────────────────────────────────
-- Mirrors radix_notation.sql's offset/complement axes over ℤ (its `unit`/negabase axis has no analogue over
-- independent CRT channels, so it stays un-ported here). offset shifts the value window to [offset, offset+M);
-- complement keeps the plain [0,M) window but reinterprets it as the signed register [−⌊M/2⌋, ⌈M/2⌉−1) by folding
-- the top half back negative (radix_complement_value's one-line idea, generalized past a single radix/digit pair).
-- The two axes are mutually exclusive framings of the same register — complement ignores offset when both are set.
CREATE FUNCTION residue_recenter(u numeric, modulus numeric) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN u >= modulus / 2 THEN u - modulus ELSE u END $$;

CREATE FUNCTION rns_digits(n numeric, moduli int[], digit_offset numeric, complement boolean) RETURNS int[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m numeric;
BEGIN
  IF complement THEN m := residue_modulus(moduli); RETURN rns_digits(((n % m) + m) % m, moduli); END IF;
  RETURN rns_digits(n - digit_offset, moduli);
END $$;

CREATE FUNCTION rns_value(digits int[], moduli int[], digit_offset numeric, complement boolean) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric := rns_value(digits, moduli);
BEGIN
  RETURN CASE WHEN complement THEN residue_recenter(v, residue_modulus(moduli)) ELSE v + digit_offset END;
END $$;

-- ── FNS — flag number system (ordered channels with carry; fixed-width mixed radix) ─────────────────────────
-- Fixed-width digit extraction over an explicit radices list, LSB-first — no coprimality precondition (plain
-- place-value doesn't need it). Shared core loop: fns_digits uses it over the channel moduli, mrns_digits (below)
-- over the prime-power-expanded radices — same carry, different granularity.
CREATE FUNCTION residue_extract_digits(n numeric, radices int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE digits int[] := '{}'; x numeric := n; i int; len int := array_length(radices, 1);
BEGIN
  FOR i IN 1..len LOOP
    digits := digits || (x % radices[i])::int;
    x := div(x, radices[i]);
  END LOOP;
  RETURN digits;
END $$;

-- fns_digits: residueᵢ = ⌊n / ∏_{j<i} m_j⌋ mod mᵢ, LSB-FIRST channel order (scheme.ts liftDigit), always padded to
-- the full register width. This IS the MNS digit loop of mixed_radix_extract, but zero-extended to the full width
-- and LSB-indexed — the tuple is a per-channel presentation of the value, carry propagating m₀ → m₁ → … (flag order).
CREATE FUNCTION fns_digits(n numeric, moduli int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  PERFORM residue_validate(moduli);
  PERFORM residue_window_check(n, moduli);
  RETURN residue_extract_digits(n, moduli);
END $$;

-- fns_value: Σᵢ dᵢ · ∏_{j<i} m_j (scheme.ts lowerDigit) — reuses the MNS reconstructor mixed_radix_value rather
-- than duplicating it (that fn wants MSB-first digits: reverse the LSB-first channel tuple).
CREATE FUNCTION fns_value(digits int[], moduli int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  PERFORM residue_validate(moduli);
  PERFORM residue_digits_check(digits, moduli);
  RETURN mixed_radix_value(
    ARRAY(SELECT digits[i] FROM generate_subscripts(digits, 1) AS g(i) ORDER BY i DESC), moduli);
END $$;

-- offset/complement axes (see the RNS section above for the shared rationale + residue_recenter).
CREATE FUNCTION fns_digits(n numeric, moduli int[], digit_offset numeric, complement boolean) RETURNS int[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m numeric;
BEGIN
  IF complement THEN m := residue_modulus(moduli); RETURN fns_digits(((n % m) + m) % m, moduli); END IF;
  RETURN fns_digits(n - digit_offset, moduli);
END $$;

CREATE FUNCTION fns_value(digits int[], moduli int[], digit_offset numeric, complement boolean) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric := fns_value(digits, moduli);
BEGIN
  RETURN CASE WHEN complement THEN residue_recenter(v, residue_modulus(moduli)) ELSE v + digit_offset END;
END $$;

-- ── MRNS — general flag with prime-power channel sub-expansion ───────────────────────────────────────────────
-- mrns_expand: a channel modulus that's a prime power p^e (e.g. 4 = 2²) sub-expands into e base-p positions
-- (scheme.ts's primeRadices, LSB-first within the channel); a prime channel (e = 1) is unchanged — one position.
-- Flattens [m₀,m₁,…] into the full list of unit prime-power radices, channel order preserved; the product (and
-- so the register window M) is invariant under the expansion, since p^e = p·p·…·p (e times).
CREATE FUNCTION mrns_expand(moduli int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE radices int[] := '{}'; m int; f factorization; i int; k int;
BEGIN
  FOREACH m IN ARRAY moduli LOOP
    f := factorize(m);
    FOR i IN 1 .. coalesce(array_length(f.primes, 1), 0) LOOP
      FOR k IN 1 .. f.powers[i] LOOP radices := radices || f.primes[i]::int; END LOOP;
    END LOOP;
  END LOOP;
  RETURN radices;
END $$;

-- mrns_digits/mrns_value: fns_digits/fns_value's carry loop, run over the expanded radices instead of the raw
-- channel moduli — a prime-power channel like 4 = 2² yields two base-2 digits instead of one 0..3 digit. Validation
-- (coprimality, window) stays on the ORIGINAL moduli: the expanded radices are siblings within one channel (e.g.
-- {2,2}), not pairwise coprime with each other, so residue_validate must not see them.
CREATE FUNCTION mrns_digits(n numeric, moduli int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  PERFORM residue_validate(moduli);
  PERFORM residue_window_check(n, moduli);
  RETURN residue_extract_digits(n, mrns_expand(moduli));
END $$;

CREATE FUNCTION mrns_value(digits int[], moduli int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE radices int[];
BEGIN
  PERFORM residue_validate(moduli);
  radices := mrns_expand(moduli);
  PERFORM residue_digits_check(digits, radices);
  RETURN mixed_radix_value(
    ARRAY(SELECT digits[i] FROM generate_subscripts(digits, 1) AS g(i) ORDER BY i DESC), radices);
END $$;

-- ── render: channel tuple + moduli spec ─────────────────────────────────────────────────────────────────────
-- '(d₀,d₁,…)' then the moduli delimiter: braces for RNS (unordered), parens for FNS (ordered) — the precursor's
-- baseLabel convention. Residues render as plain decimal (channels are independent moduli; no shared glyph base).
CREATE FUNCTION residue_render(digits int[], moduli int[], braced boolean) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string(digits, ',') || ')'
      || CASE WHEN braced THEN '{'
              ELSE '(' END || array_to_string(moduli, ',') || CASE WHEN braced THEN '}' ELSE ')' END $$;

-- ── the unary render_fns registered in base_repr (carrier is numeric; out-of-window → NULL like to_roman) ────
-- The two exemplar systems of the precursor's radix catalog: Residue {3,5,7} (window 105) and Flag (4,3,5)
-- (window 60; the 2² channel shows a prime power is a legal channel).
CREATE FUNCTION to_residue_3_5_7(n numeric) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF n IS NULL OR n <> trunc(n) OR n < 0 OR n >= 105 THEN RETURN NULL; END IF;
  RETURN residue_render(rns_digits(n, ARRAY[3,5,7]), ARRAY[3,5,7], true);
END $$;

CREATE FUNCTION to_flag_4_3_5(n numeric) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF n IS NULL OR n <> trunc(n) OR n < 0 OR n >= 60 THEN RETURN NULL; END IF;
  RETURN residue_render(fns_digits(n, ARRAY[4,3,5]), ARRAY[4,3,5], false);
END $$;

-- ── register base_repr rows ─────────────────────────────────────────────────────────────────────────────────
-- ℕ-only presentations: the register window is [0, M), mirroring how factorial/roman are natural_numbers-only.
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('natural_numbers','residue_3_5_7','to_residue_3_5_7','Residue {3,5,7} (RNS: CRT channels, no carry)',   false),
  ('natural_numbers','flag_4_3_5',   'to_flag_4_3_5',   'Flag (4,3,5) (FNS: ordered channels with carry)', false);

-- ── examples (ported from the precursor's src/examples.ts residue/flag groups + radixCatalog goldens) ───────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('residue_notation','7 mod (5,3) — RNS residue tuple (2,1)','eq','2,1','examples.ts: NS.RNS([5,3],1).element(7).digits()[0]',$q$
    SELECT array_to_string(rns_digits(7, ARRAY[5,3]), ',') $q$),
  ('residue_notation','7 mod (3,4,5) — three coprime channels (1,3,2)','eq','1,3,2','examples.ts: NS.RNS([3,4,5],1) (the 4 = 2² channel is a prime power — legal)',$q$
    SELECT array_to_string(rns_digits(7, ARRAY[3,4,5]), ',') $q$),
  ('residue_notation','CRT reconstruction: value of (2,1) over {5,3} is 7','eq','7|7','rns_value inverts rns_digits (scheme.ts lowerDigitCRT)',$q$
    SELECT rns_value(ARRAY[2,1], ARRAY[5,3])::text || '|' || rns_value(ARRAY[1,3,2], ARRAY[3,4,5])::text $q$),
  ('residue_notation','CRT round-trip over {3,5,7}: every value in [0,105) survives','eq','true','rns_value ∘ rns_digits = id on the whole register window (M = 105)',$q$
    SELECT bool_and(rns_value(rns_digits(n, ARRAY[3,5,7]), ARRAY[3,5,7]) = n)::text FROM generate_series(0, 104) n $q$),
  ('residue_notation','100 in residue {3,5,7} renders (1,0,2){3,5,7}','eq','(1,0,2){3,5,7}','radixCatalog golden: Residue {3,5,7} of 100 has digits [1,0,2]',$q$
    SELECT to_residue_3_5_7(100) $q$),
  ('residue_notation','3811 in base 15 — digits (MSB-first) [1,1,14,1] and reconstruction','eq','1,1,14,1|3811','examples.ts: NS.FNS([15],4).element(3811); the radix engine carries the outer register',$q$
    SELECT array_to_string(radix_extract(3811, 15, 0, 1), ',') || '|' ||
           radix_value(radix_extract(3811, 15, 0, 1), 15, 1)::text $q$),
  ('residue_notation','3811 RNS-residue-coded per base-15 digit over {5,3}: (1,1)(1,1)(4,2)(1,1)','eq','1,1;1,1;4,2;1,1','examples.ts: NS.RNS([5,3],4).element(3811).digits() = [[1,1],[1,1],[4,2],[1,1]]',$q$
    SELECT string_agg(array_to_string(rns_digits(d, ARRAY[5,3]), ','), ';' ORDER BY o)
    FROM unnest(radix_extract(3811, 15, 0, 1)) WITH ORDINALITY AS t(d, o) $q$),
  ('residue_notation','3811 FNS-coded per base-15 digit over (5,3): (1,0)(1,0)(4,2)(1,0)','eq','1,0;1,0;4,2;1,0','examples.ts: NS.FNS([5,3],4) per-digit mixed radix — carry makes 14 → 4·1 + 2·5, not 14 mod 5 / 14 mod 3',$q$
    SELECT string_agg(array_to_string(fns_digits(d, ARRAY[5,3]), ','), ';' ORDER BY o)
    FROM unnest(radix_extract(3811, 15, 0, 1)) WITH ORDINALITY AS t(d, o) $q$),
  ('residue_notation','FNS round-trip over (4,3,5): every value in [0,60) survives','eq','true','fns_value ∘ fns_digits = id on the whole register window (M = 60)',$q$
    SELECT bool_and(fns_value(fns_digits(n, ARRAY[4,3,5]), ARRAY[4,3,5]) = n)::text FROM generate_series(0, 59) n $q$),
  ('residue_notation','40 in flag (4,3,5) renders (0,1,3)(4,3,5)','eq','(0,1,3)(4,3,5)','radixCatalog''s Flag (4,3,5) exemplar wraps 100 cyclically (100 mod 60 = 40); here the window is hard, so 40 = 0·1 + 1·4 + 3·(4·3), carry ordered m₀ → m₂',$q$
    SELECT to_flag_4_3_5(40) $q$),
  ('residue_notation','flag order vs CRT independence: 1 in scheme (3,5) is FNS (1,0) but RNS (1,1)','eq','1,0|1,1','scheme.ts: distinct from FNS — the carry channel rolls over, the CRT channel does not',$q$
    SELECT array_to_string(fns_digits(1, ARRAY[3,5]), ',') || '|' || array_to_string(rns_digits(1, ARRAY[3,5]), ',') $q$),
  ('residue_notation','coprimality guard: {4,6} and {1,3} raise (not pairwise coprime / modulus < 2)','eq','true|true','the CRT precondition is enforced on every call (ns.ts validateScheme)',$q$
    SELECT base_raises($e$ SELECT rns_digits(5, ARRAY[4,6]) $e$)::text || '|' ||
           base_raises($e$ SELECT fns_digits(5, ARRAY[1,3]) $e$)::text $q$),
  ('residue_notation','range guards: 105 ∉ [0,105) raises; 60 ∉ [0,60) raises; fraction raises','eq','true|true|true','the register window [0, M) is a hard domain (no cyclic wrap)',$q$
    SELECT base_raises($e$ SELECT rns_digits(105, ARRAY[3,5,7]) $e$)::text || '|' ||
           base_raises($e$ SELECT fns_digits(60, ARRAY[4,3,5]) $e$)::text || '|' ||
           base_raises($e$ SELECT rns_digits(2.5, ARRAY[3,5,7]) $e$)::text $q$),
  ('residue_notation','reconstructor guards: residue ≥ modulus and wrong tuple length raise','eq','true|true','0 ≤ dᵢ < mᵢ, one residue per channel (residue_digits_check)',$q$
    SELECT base_raises($e$ SELECT rns_value(ARRAY[3,0], ARRAY[3,5]) $e$)::text || '|' ||
           base_raises($e$ SELECT rns_value(ARRAY[1,2], ARRAY[3,5,7]) $e$)::text $q$),
  ('residue_notation','out-of-window renders NULL (like to_roman), not an error','eq','true|true','base_repr renderers return NULL out of support',$q$
    SELECT (to_residue_3_5_7(105) IS NULL)::text || '|' || (to_flag_4_3_5(-1) IS NULL)::text $q$),
  ('residue_notation','naturals now carry the residue presentations (RNS braced, FNS parenthesised)','eq','flag_4_3_5|residue_3_5_7','base_repr rows on natural_numbers; neither is canonical (decimal is)',$q$
    SELECT string_agg(repr, '|' ORDER BY repr) FROM base_repr
    WHERE collection = 'natural_numbers' AND repr IN ('residue_3_5_7', 'flag_4_3_5') $q$);

-- ── examples: general MRNS (prime-power channel sub-expansion, #155 deferred item 1) ───────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('residue_notation','mrns_expand: a 4 = 2² channel sub-expands into two base-2 positions','eq','2,2,3,5','scheme.ts primeRadices, generalized into a full flag digit engine: {4,3,5} → {2,2,3,5}',$q$
    SELECT array_to_string(mrns_expand(ARRAY[4,3,5]), ',') $q$),
  ('residue_notation','7 over MRNS(4,3,5): the 2² channel splits fns_digits'' single digit 3 into two base-2 digits (1,1)','eq','1,1,1,0','fns_digits(7,{4,3,5}) has one digit 3 in the first channel; mrns_digits splits it (1,1) then leaves the rest',$q$
    SELECT array_to_string(mrns_digits(7, ARRAY[4,3,5]), ',') $q$),
  ('residue_notation','MRNS round-trip over (4,3,5): every value in [0,60) survives','eq','true','mrns_value ∘ mrns_digits = id on the whole register window (M = 60), same window as FNS',$q$
    SELECT bool_and(mrns_value(mrns_digits(n, ARRAY[4,3,5]), ARRAY[4,3,5]) = n)::text FROM generate_series(0, 59) n $q$),
  ('residue_notation','all-prime channels: MRNS(3,5,7) sub-expands to nothing new, matches FNS digit-for-digit','eq','3,5,7|true','no prime-power channel ⇒ mrns_expand is the identity on the moduli',$q$
    SELECT array_to_string(mrns_expand(ARRAY[3,5,7]), ',') || '|' ||
           bool_and(mrns_digits(n, ARRAY[3,5,7]) = fns_digits(n, ARRAY[3,5,7]))::text
    FROM generate_series(0, 104) n $q$),
  ('residue_notation','13 over MRNS(8,3): the 2³ channel sub-expands into three base-2 positions','eq','13','8 = 2³ ⇒ three base-2 digits ahead of the base-3 channel; mrns_value inverts mrns_digits',$q$
    SELECT mrns_value(mrns_digits(13, ARRAY[8,3]), ARRAY[8,3])::text $q$);

-- ── examples: register axes — offset, complement (#155 deferred item 2) ─────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('residue_notation','offset axis: RNS {3,5,7} shifted +100 reads 107 as (1,2,0), round-trips','eq','1,2,0|107','offset windows the register to [100,205); mirrors radix_notation''s bijective/balanced offset',$q$
    SELECT array_to_string(rns_digits(107, ARRAY[3,5,7], 100, false), ',') || '|' ||
           rns_value(rns_digits(107, ARRAY[3,5,7], 100, false), ARRAY[3,5,7], 100, false)::text $q$),
  ('residue_notation','offset round-trip over {3,5,7} shifted +100: every value in [100,205) survives','eq','true','offset ∘ rns_value ∘ rns_digits = id, window translated by +100',$q$
    SELECT bool_and(rns_value(rns_digits(n, ARRAY[3,5,7], 100, false), ARRAY[3,5,7], 100, false) = n)::text
    FROM generate_series(100, 204) n $q$),
  ('residue_notation','complement axis: FNS (4,3,5) reads −7 via the unsigned ring rep 53','eq','-7','complement folds the top half of [0,60) negative (radix_complement_value, generalized past one radix)',$q$
    SELECT fns_value(fns_digits(-7, ARRAY[4,3,5], 0, true), ARRAY[4,3,5], 0, true)::text $q$),
  ('residue_notation','complement round-trip over (4,3,5): every value in the signed window [-30,29] survives','eq','true','complement ∘ fns_value ∘ fns_digits = id on the recentered register',$q$
    SELECT bool_and(fns_value(fns_digits(n, ARRAY[4,3,5], 0, true), ARRAY[4,3,5], 0, true) = n)::text
    FROM generate_series(-30, 29) n $q$),
  ('residue_notation','complement ignores offset: rns_digits(7,{3,5,7},999,true) = rns_digits(7,{3,5,7})','eq','true','the two axes are mutually exclusive framings of the same register',$q$
    SELECT (rns_digits(7, ARRAY[3,5,7], 999, true) = rns_digits(7, ARRAY[3,5,7]))::text $q$);

