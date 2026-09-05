-- utilities — general scalar/integer math helpers, defined ONCE and early so any collection can use them
-- (via `-- requires: utilities`) instead of reaching into whatever collection first happened to define one.
-- Pure functions, no base_* dependency.

CREATE FUNCTION pow_int(b int, e int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- exact (no numeric ^ scaling)
  DECLARE p numeric:=1; i int; BEGIN FOR i IN 1..e LOOP p:=p*b; END LOOP; RETURN p; END $$;

CREATE FUNCTION gcd_int(a int, b int) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE t int; BEGIN WHILE b <> 0 LOOP t := b; b := a % b; a := t; END LOOP; RETURN abs(a); END $$;

CREATE FUNCTION binary_popcount(n numeric) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$   -- # of 1-bits (hoisted from evil_numbers; shared with k_bounded_compositions)
  DECLARE m numeric:=trunc(n); c int:=0; BEGIN WHILE m>0 LOOP c:=c+mod(m,2)::int; m:=div(m,2); END LOOP; RETURN c; END $$;

CREATE FUNCTION to_unicode_subscript(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- 42 → ₄₂ (U+2080…2089, minus → ₋)
  SELECT string_agg(CASE WHEN ch = '-' THEN '₋' ELSE chr(8320 + ch::int) END, '' ORDER BY o)
  FROM unnest(string_to_array(n::text, NULL)) WITH ORDINALITY AS t(ch, o) $$;

CREATE FUNCTION to_unicode_superscript(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- 42 → ⁴² (⁰¹²³⁴⁵⁶⁷⁸⁹, minus → ⁻)
  SELECT string_agg(CASE WHEN ch = '-' THEN '⁻' ELSE substr('⁰¹²³⁴⁵⁶⁷⁸⁹', ch::int + 1, 1) END, '' ORDER BY o)
  FROM unnest(string_to_array(n::text, NULL)) WITH ORDINALITY AS t(ch, o) $$;

CREATE FUNCTION to_combining_underline(n numeric) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- 2 → 2̲ (each digit + U+0332); falling-factorial exponent
  SELECT string_agg(ch || chr(818), '' ORDER BY o) FROM unnest(string_to_array(n::text, NULL)) WITH ORDINALITY AS t(ch, o) $$;

CREATE FUNCTION to_combining_overline(s text) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- 'IV' → I̅V̅ (each char + U+0305); balanced-digit / roman vinculum bar
  SELECT string_agg(ch || chr(773), '' ORDER BY o) FROM unnest(string_to_array(s, NULL)) WITH ORDINALITY AS t(ch, o) $$;

CREATE FUNCTION factorial(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p numeric := 1; i int; BEGIN FOR i IN 2..n LOOP p := p*i; END LOOP; RETURN p; END $$;

CREATE FUNCTION binomial(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$   -- numeric: C(n,k) overflows int4 for modest n (e.g. C(40,20) ≈ 1.4e11)
  DECLARE num numeric := 1; den numeric := 1; i int; kk int := least(k, n-k); BEGIN
    IF k < 0 OR k > n THEN RETURN 0; END IF;
    FOR i IN 0..kk-1 LOOP num := num*(n-i); den := den*(i+1); END LOOP;
    RETURN round(num/den);
  END $$;

CREATE FUNCTION double_factorial_odd(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p numeric := 1; i int; BEGIN FOR i IN 1..n LOOP p := p * (2*i - 1); END LOOP; RETURN p; END $$;

-- Low-precision variants: native bigint (int8) arithmetic instead of arbitrary-precision numeric. Same value on the
-- int8-representable domain, but machine integers — a real win (≈1.5–2×) in tight enumeration loops (e.g. a
-- combinatorial-number-system unrank) whose results are known bounded. Overflow RAISES ('bigint out of range'),
-- never a silent wrong answer, so a caller opts in only where the range is guaranteed. The exact numeric forms above
-- stay the default. (Arbitrary-precision-but-fast big-integer forms are pgmp-gated — deferred, no pgmp in pglite.)
CREATE FUNCTION factorial_bigint(n int) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$   -- exact for n ≤ 20; 21! overflows int8 → raises
  DECLARE p bigint := 1; i int; BEGIN FOR i IN 2..n LOOP p := p*i; END LOOP; RETURN p; END $$;

CREATE FUNCTION binomial_bigint(n int, k int) RETURNS bigint LANGUAGE plpgsql IMMUTABLE AS $$   -- interleaved product/quotient is integer each step (no numeric round)
  DECLARE res bigint := 1; i int; kk int := least(k, n-k); BEGIN
    IF k < 0 OR k > n THEN RETURN 0; END IF;
    FOR i IN 0..kk-1 LOOP res := res * (n-i) / (i+1); END LOOP;
    RETURN res;
  END $$;

-- living assertions: the bigint variants agree with the exact numeric primitives across the int8 domain, and overflow raises.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('utilities','factorial_bigint matches factorial for n ≤ 20','eq','true','native int8 factorial agrees with the exact numeric form across its whole valid range',$q$
    SELECT bool_and(factorial_bigint(n) = factorial(n)::bigint)::text FROM generate_series(0,20) n $q$),
  ('utilities','factorial_bigint(21) overflows int8 (raises, never silently wrong)','eq','true','21! > int8 max — a caller opts in only where n ≤ 20',$q$
    SELECT base_raises($e$ SELECT factorial_bigint(21) $e$)::text $q$),
  ('utilities','binomial_bigint matches binomial across the int8 range','eq','true','interleaved exact division (no numeric round) agrees with the numeric closed form',$q$
    SELECT bool_and(binomial_bigint(n,k) = binomial(n,k)::bigint)::text
    FROM generate_series(0,52) n, generate_series(0,52) k WHERE k <= n AND binomial(n,k) <= 9223372036854775807 $q$),
  ('utilities','binomial_bigint out-of-support is 0 (k<0 or k>n)','eq','true','matches the numeric variant''s support convention',$q$
    SELECT (binomial_bigint(5,-1) = 0 AND binomial_bigint(5,9) = 0)::text $q$);
