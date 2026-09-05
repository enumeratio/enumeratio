-- requires: realizer
-- kaprekar_numbers — positive integers n such that n^2 splits into a left/right decimal part summing to n
-- (A006886). n=1 is Kaprekar by convention; for n>1, n is Kaprekar iff there exists a split point d with
-- 1 <= d < digits(n^2) such that r = n^2 mod 10^d, q = div(n^2, 10^d), r > 0, and q + r = n.
-- Members: 1,9,45,55,99,297,703,999,2223,2728,… Unbounded number set (carrier numeric).

-- ── the predicate ────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION is_kaprekar(n numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE nsq numeric; pow10 numeric; r numeric; q numeric; BEGIN
    IF n < 1 THEN RETURN false; END IF;
    IF n = 1 THEN RETURN true; END IF;
    nsq := n * n;
    pow10 := 10;
    WHILE pow10 < nsq LOOP                          -- pow10 = 10^d for d = 1 .. digits(nsq)-1
      r := mod(nsq, pow10);
      q := div(nsq, pow10);
      IF r > 0 AND q + r = n THEN RETURN true; END IF;
      pow10 := pow10 * 10;
    END LOOP;
    RETURN false;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: search window of 1000 comfortably contains the first 8 members (1,9,45,55,99,297,703,999).
CREATE TYPE kaprekar_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f kaprekar_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, 1000) n WHERE is_kaprekar(n::numeric) LIMIT element_limit $$;

CREATE FUNCTION contains_in_fiber(f kaprekar_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_kaprekar(v) $$;

-- declare it as DATA (unbounded, no grades) + realize
INSERT INTO base_collection VALUES ('kaprekar_numbers', 'numeric', true);
CREATE FUNCTION fiber_symbol(f kaprekar_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Kap' $$;   -- corpus symbol
SELECT base_realize('kaprekar_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('kaprekar_numbers','first eight members','eq','1,9,45,55,99,297,703,999','A006886 anchor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(kaprekar_numbers(), 8) e $q$),
  ('kaprekar_numbers','worked check: 45² = 2025, split 20|25, 20+25 = 45','eq','true','the defining split',$q$
    SELECT is_kaprekar(45) $q$),
  ('kaprekar_numbers','cardinality is Infinity','eq','Infinity','unbounded number set',$q$
    SELECT cardinality(kaprekar_numbers())::text $q$),
  ('kaprekar_numbers','contains: 45 ∈, 46 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (45::numeric <@ kaprekar_numbers())::text || '|' || (46::numeric <@ kaprekar_numbers())::text $q$);
