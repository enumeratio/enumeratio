-- requires: natural_numbers, integer_numbers, utilities
-- radix_notation — place-value notation engine, ported from the precursor's src/ns.ts (+ roman.ts). The naturals and
-- integers carried ZERO base_repr rows; this adds their number notations, all thin wrappers over one digit engine.
--
-- The engine models three axes (ns.ts's NSOptions):
--   offset  — shifts the digit alphabet {offset … offset+radix−1}:  0 standard, 1 bijective, −⌊radix/2⌋ balanced.
--   unit    — place-value sign:  +1 normal,  −1 negabase (base −radix, both signs from the {0…radix−1} alphabet).
--   complement — signed-window recentering: keep the {0…radix−1} alphabet but read the ring rep of a fixed-width
--                register (radix-complement / two's-complement framing). Needs a width, so it is a core fn + examples,
--                not a base_repr row (render_fn is unary — just the carrier).
-- Plus mixed-radix (MNS): per-position moduli instead of one fixed radix (e.g. the factorial base [2,3,4,…]).
--
-- The within-digit CRT channels (ns.ts's FNS-ordered vs RNS-unordered partition of a digit) are not needed by any
-- standard numeral and are left un-ported. Alphabetic digit substitution (DNA/cards/greek) is a later demo layer.

-- ── core: fixed-radix digit extraction / reconstruction ─────────────────────────────────────────────────────
-- Extract the digit VALUES of n (MSB-first) for a fixed radix under the (offset, unit) axes. Digit values are signed
-- (balanced yields negatives); render maps them to glyphs. standard/bijective assume n ≥ 0; balanced/negabase take
-- any sign. bijective represents 0 as the empty word; the others emit a single 0 digit.
CREATE FUNCTION radix_extract(n numeric, radix int, digit_offset int, unit int) RETURNS int[]
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE digits int[] := '{}'; x numeric := n; r int; d int;   -- digits accumulate LSB-first
BEGIN
  IF radix < 2 THEN RAISE EXCEPTION 'radix must be ≥ 2, got %', radix; END IF;
  IF unit = -1 THEN                                            -- negabase: place-value base −radix
    LOOP
      r := ((((x - digit_offset) % radix) + radix) % radix)::int;    -- 0 … radix−1
      d := r + digit_offset;                                  -- digit value in {digit_offset … +radix−1}
      digits := digits || d;
      x := (x - d) / (-radix);
      EXIT WHEN x = 0;
    END LOOP;
  ELSIF digit_offset > 0 THEN                                  -- bijective: alphabet {digit_offset … +radix−1}, 0 → ''
    WHILE x > 0 LOOP
      d := ((((x - digit_offset) % radix) + radix) % radix)::int + digit_offset;
      digits := digits || d;
      x := (x - d) / radix;
    END LOOP;
  ELSIF digit_offset < 0 THEN                                  -- balanced: symmetric window folded around 0
    LOOP
      r := (((x % radix) + radix) % radix)::int;               -- 0 … radix−1
      IF r > digit_offset + radix - 1 THEN r := r - radix; END IF;  -- fold high residues into {digit_offset … −1}
      digits := digits || r;
      x := (x - r) / radix;
      EXIT WHEN x = 0;
    END LOOP;
  ELSE                                                         -- standard positional (offset 0), n ≥ 0
    LOOP
      digits := digits || (x % radix)::int;
      x := div(x, radix);
      EXIT WHEN x = 0;
    END LOOP;
  END IF;
  RETURN ARRAY(SELECT digits[i] FROM generate_subscripts(digits, 1) AS g(i) ORDER BY i DESC);  -- MSB-first
END $$;

-- Reconstruct the value from MSB-first digit values (inverse of radix_extract): Σ dᵢ·(unit·radix)^place.
CREATE FUNCTION radix_value(digits int[], radix int, unit int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(digits[i] * pow_int(radix * unit, array_length(digits, 1) - i)), 0)
  FROM generate_subscripts(digits, 1) AS g(i) $$;

-- ── core: mixed-radix (MNS) — per-position moduli, LSB-first ─────────────────────────────────────────────────
CREATE FUNCTION mixed_radix_extract(n numeric, moduli int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE digits int[] := '{}'; x numeric := n; i int := 1;
BEGIN
  IF n < 0 THEN RAISE EXCEPTION 'mixed_radix_extract needs n ≥ 0, got %', n; END IF;
  WHILE x > 0 LOOP
    IF i > coalesce(array_length(moduli, 1), 0) THEN RAISE EXCEPTION 'moduli too short (%) for %', moduli, n; END IF;
    digits := digits || (x % moduli[i])::int;
    x := div(x, moduli[i]);
    i := i + 1;
  END LOOP;
  IF array_length(digits, 1) IS NULL THEN digits := ARRAY[0]; END IF;   -- n = 0
  RETURN ARRAY(SELECT digits[j] FROM generate_subscripts(digits, 1) AS g(j) ORDER BY j DESC);
END $$;

CREATE FUNCTION mixed_radix_value(digits int[], moduli int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v numeric := 0; w numeric := 1; len int := array_length(digits, 1); k int;
BEGIN
  FOR k IN 0 .. len - 1 LOOP           -- k = LSB place index
    v := v + digits[len - k] * w;      -- digits are MSB-first, so LSB place k sits at index len−k
    w := w * moduli[k + 1];
  END LOOP;
  RETURN v;
END $$;

-- ── core: signed-window (radix complement) ──────────────────────────────────────────────────────────────────
-- Fixed-width radix-complement digits: the width-digit base-radix rep of (n mod radix^width), so a k-digit register
-- holds [−⌊N/2⌋, ⌈N/2⌉−1] with the top residues denoting negatives (two's-complement at radix 2). MSB-first.
CREATE FUNCTION radix_complement_extract(n numeric, radix int, width int) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE modulus numeric := pow_int(radix, width); x numeric; digits int[] := '{}'; i int;
BEGIN
  x := ((n % modulus) + modulus) % modulus;         -- ring representative in [0, radix^width)
  FOR i IN 1 .. width LOOP                           -- fixed width, zero-padded, LSB-first then reversed
    digits := digits || (x % radix)::int;
    x := div(x, radix);
  END LOOP;
  RETURN ARRAY(SELECT digits[j] FROM generate_subscripts(digits, 1) AS g(j) ORDER BY j DESC);
END $$;

-- Interpret width-digit radix-complement digits back to a signed value (top half of the window is negative).
CREATE FUNCTION radix_complement_value(digits int[], radix int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN u >= modulus / 2 THEN u - modulus ELSE u END
  FROM (SELECT radix_value(digits, radix, 1) AS u, pow_int(radix, array_length(digits, 1)) AS modulus) t $$;

-- ── render: digit values → glyphs ───────────────────────────────────────────────────────────────────────────
-- Dense glyphs 0-9a-z (radix ≤ 36, matching Number.toString); a negative (balanced) digit gets a combining overline.
-- The empty word renders '' (bijective zero).
CREATE FUNCTION radix_render(digits int[]) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE dense text := '0123456789abcdefghijklmnopqrstuvwxyz'; out text := ''; d int; g text;
BEGIN
  IF digits IS NULL OR array_length(digits, 1) IS NULL THEN RETURN ''; END IF;
  FOREACH d IN ARRAY digits LOOP
    g := CASE WHEN abs(d) < 36 THEN substr(dense, abs(d) + 1, 1) ELSE '[' || abs(d) || ']' END;
    IF d < 0 THEN g := to_combining_overline(g); END IF;
    out := out || g;
  END LOOP;
  RETURN out;
END $$;

-- ── radix-parametrized engines (each numeral is one of these with a fixed radix) ────────────────────────────
CREATE FUNCTION radix_positional(n numeric, radix int) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- sign-magnitude
  SELECT CASE WHEN n < 0 THEN '-' || radix_render(radix_extract(-n, radix, 0, 1))
                         ELSE       radix_render(radix_extract( n, radix, 0, 1)) END $$;
CREATE FUNCTION radix_bijective(n numeric, radix int) RETURNS text LANGUAGE sql IMMUTABLE AS $$    -- positives only
  SELECT CASE WHEN n < 0 THEN NULL ELSE radix_render(radix_extract(n, radix, 1, 1)) END $$;
CREATE FUNCTION radix_balanced(n numeric, radix int) RETURNS text LANGUAGE sql IMMUTABLE AS $$     -- native signed
  SELECT radix_render(radix_extract(n, radix, -(radix / 2), 1)) $$;
CREATE FUNCTION radix_negabase(n numeric, radix int) RETURNS text LANGUAGE sql IMMUTABLE AS $$     -- native signed
  SELECT radix_render(radix_extract(n, radix, 0, -1)) $$;

-- ── the unary render_fns registered in base_repr (render_fn takes the carrier, numeric) ─────────────────────
CREATE FUNCTION to_decimal(n numeric)     RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_positional(n, 10) $$;
CREATE FUNCTION to_binary(n numeric)      RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_positional(n, 2)  $$;
CREATE FUNCTION to_octal(n numeric)       RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_positional(n, 8)  $$;
CREATE FUNCTION to_hexadecimal(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_positional(n, 16) $$;
CREATE FUNCTION to_bijective_decimal(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_bijective(n, 10) $$;
CREATE FUNCTION to_balanced_ternary(n numeric)  RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_balanced(n, 3)  $$;
CREATE FUNCTION to_negabinary(n numeric)  RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_negabase(n, 2) $$;
CREATE FUNCTION to_negaternary(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT radix_negabase(n, 3) $$;

-- factorial base (MNS): radices 2,3,4,… — grow just enough positions to hold n.
CREATE FUNCTION to_factorial_base(n numeric) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE moduli int[] := '{}'; f numeric := 1; k int := 1;
BEGIN
  IF n < 0 THEN RETURN NULL; END IF;
  WHILE f <= n LOOP k := k + 1; f := f * k; moduli := moduli || k; END LOOP;   -- radices 2,3,4,… while k! ≤ n
  IF array_length(moduli, 1) IS NULL THEN moduli := ARRAY[2]; END IF;          -- n = 0 or 1
  RETURN radix_render(mixed_radix_extract(n, moduli));
END $$;

-- ── roman.ts: additive/subtractive numerals, vinculum (×1000) for >3999 via combining overline ──────────────
-- Range 0–3,999,999. 0 → '' (no Roman form). Bars: M̅=1e6 … V̅=5000; MX̅=9000, MV̅=4000 (subtractive across the bar).
CREATE FUNCTION to_roman(n numeric) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  vals numeric[] := ARRAY[1000000,900000,500000,400000,100000,90000,50000,40000,10000,9000,5000,4000,
                          1000,900,500,400,100,90,50,40,10,9,5,4,1];
  syms text[];
  out text := ''; rem numeric := n; i int;
BEGIN
  IF n IS NULL OR n < 0 OR n > 3999999 OR n <> trunc(n) THEN RETURN NULL; END IF;
  syms := ARRAY[
    to_combining_overline('M'),  to_combining_overline('CM'), to_combining_overline('D'),  to_combining_overline('CD'),
    to_combining_overline('C'),  to_combining_overline('XC'), to_combining_overline('L'),  to_combining_overline('XL'),
    to_combining_overline('X'),  'M' || to_combining_overline('X'), to_combining_overline('V'), 'M' || to_combining_overline('V'),
    'M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
  FOR i IN 1 .. array_length(vals, 1) LOOP
    WHILE rem >= vals[i] LOOP out := out || syms[i]; rem := rem - vals[i]; END LOOP;
  END LOOP;
  RETURN out;
END $$;

-- ── register base_repr rows ─────────────────────────────────────────────────────────────────────────────────
-- naturals get every system; integers get only the sign-capable ones (bijective/factorial/roman are ℕ-only).
INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('natural_numbers','decimal',          'to_decimal',          'Decimal',            true),
  ('natural_numbers','binary',           'to_binary',           'Binary',             false),
  ('natural_numbers','octal',            'to_octal',            'Octal',              false),
  ('natural_numbers','hexadecimal',      'to_hexadecimal',      'Hexadecimal',        false),
  ('natural_numbers','bijective_decimal','to_bijective_decimal','Bijective base-10',  false),
  ('natural_numbers','balanced_ternary', 'to_balanced_ternary', 'Balanced ternary',   false),
  ('natural_numbers','negabinary',       'to_negabinary',       'Negabinary (base −2)', false),
  ('natural_numbers','negaternary',      'to_negaternary',      'Negaternary (base −3)', false),
  ('natural_numbers','factorial',        'to_factorial_base',   'Factorial base',     false),
  ('natural_numbers','roman',            'to_roman',            'Roman numerals',     false),
  ('integer_numbers','decimal',          'to_decimal',          'Decimal',            true),
  ('integer_numbers','binary',           'to_binary',           'Binary',             false),
  ('integer_numbers','octal',            'to_octal',            'Octal',              false),
  ('integer_numbers','hexadecimal',      'to_hexadecimal',      'Hexadecimal',        false),
  ('integer_numbers','balanced_ternary', 'to_balanced_ternary', 'Balanced ternary',   false),
  ('integer_numbers','negabinary',       'to_negabinary',       'Negabinary (base −2)', false),
  ('integer_numbers','negaternary',      'to_negaternary',      'Negaternary (base −3)', false);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('radix_notation','positional 42 → binary/octal/hex/decimal','eq','101010|52|2a|42','the four standard bases',$q$
    SELECT to_binary(42) || '|' || to_octal(42) || '|' || to_hexadecimal(42) || '|' || to_decimal(42) $q$),
  ('radix_notation','hex 255 → ff, 0 → 0','eq','ff|0','dense glyphs, single-zero floor',$q$
    SELECT to_hexadecimal(255) || '|' || to_hexadecimal(0) $q$),
  ('radix_notation','binary round-trips: value(extract(42)) = 42','eq','42','radix_extract ∘ radix_value inverse',$q$
    SELECT radix_value(radix_extract(42, 2, 0, 1), 2, 1)::text $q$),
  ('radix_notation','bijective base-10: 0 → "" , 10 → a, 11 → 11, 20 → 1a, 100 → 9a','eq','|a|11|1a|9a','digits {1…10}, no zero digit',$q$
    SELECT to_bijective_decimal(0) || '|' || to_bijective_decimal(10) || '|' || to_bijective_decimal(11) || '|' ||
           to_bijective_decimal(20) || '|' || to_bijective_decimal(100) $q$),
  ('radix_notation','balanced ternary round-trips for 5 and −5','eq','5|-5','symmetric {−1,0,1} digits, signed',$q$
    SELECT radix_value(radix_extract(5, 3, -1, 1), 3, 1)::text || '|' ||
           radix_value(radix_extract(-5, 3, -1, 1), 3, 1)::text $q$),
  ('radix_notation','balanced ternary 2 renders 1T̅ (overlined trit)','eq','true','negative digit gets a combining overline',$q$
    SELECT (to_balanced_ternary(2) = '1' || to_combining_overline('1'))::text $q$),
  ('radix_notation','negabinary 2 → 110, 3 → 111, 6 → 11010','eq','110|111|11010','base −2, digits {0,1}, no sign',$q$
    SELECT to_negabinary(2) || '|' || to_negabinary(3) || '|' || to_negabinary(6) $q$),
  ('radix_notation','negabinary reaches negatives: −1 → 11, −3 → 1101','eq','11|1101','a negabase encodes both signs',$q$
    SELECT to_negabinary(-1) || '|' || to_negabinary(-3) $q$),
  ('radix_notation','factorial base (MNS): 5 → 21, 23 → 321','eq','21|321','mixed radix 2,3,4,…',$q$
    SELECT to_factorial_base(5) || '|' || to_factorial_base(23) $q$),
  ('radix_notation','factorial base round-trips 23 via mixed_radix_value','eq','23','MNS extract/value inverse over [2,3,4]',$q$
    SELECT mixed_radix_value(mixed_radix_extract(23, ARRAY[2,3,4]), ARRAY[2,3,4])::text $q$),
  ('radix_notation','two''s complement (radix 2, width 8): −1 → 11111111, −3 → 11111101','eq','11111111|11111101','signed-window recentering',$q$
    SELECT radix_render(radix_complement_extract(-1, 2, 8)) || '|' || radix_render(radix_complement_extract(-3, 2, 8)) $q$),
  ('radix_notation','complement round-trips: value(extract(−7, width 8)) = −7','eq','-7','the ring rep decodes back to the signed value',$q$
    SELECT radix_complement_value(radix_complement_extract(-7, 2, 8), 2)::text $q$),
  ('radix_notation','integers render signed: binary −5 → -101, hex −255 → -ff','eq','-101|-ff','sign-magnitude positional on ℤ',$q$
    SELECT to_binary((-5)::integer_number) || '|' || to_hexadecimal((-255)::integer_number) $q$),
  ('radix_notation','roman: 4 → IV, 9 → IX, 42 → XLII, 1994 → MCMXCIV, 2024 → MMXXIV, 0 → ""','eq','IV|IX|XLII|MCMXCIV|MMXXIV|','additive/subtractive; 0 has no form',$q$
    SELECT to_roman(4) || '|' || to_roman(9) || '|' || to_roman(42) || '|' || to_roman(1994) || '|' ||
           to_roman(2024) || '|' || to_roman(0) $q$),
  ('radix_notation','roman vinculum: 4000 → M V̅ , 1e6 → M̅ (×1000 bar for >3999)','eq','true','combining-overline vinculum',$q$
    SELECT (to_roman(4000) = 'M' || to_combining_overline('V') AND to_roman(1000000) = to_combining_overline('M'))::text $q$),
  ('radix_notation','naturals carry reprs (registry grows); decimal is canonical','eq','true|decimal','base_repr count grows as notations are added — assert the floor, not an exact count',$q$
    SELECT ((SELECT count(*) FROM base_repr WHERE collection = 'natural_numbers') >= 10)::text || '|' ||
           (SELECT repr FROM base_repr WHERE collection = 'natural_numbers' AND canonical) $q$),
  ('radix_notation','integers get the sign-capable subset (no bijective/factorial/roman)','eq','false|false','ℤ omits the ℕ-only systems',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr WHERE collection = 'integer_numbers' AND repr = 'bijective_decimal'))::text || '|' ||
           (EXISTS (SELECT 1 FROM base_repr WHERE collection = 'integer_numbers' AND repr = 'roman'))::text $q$);
