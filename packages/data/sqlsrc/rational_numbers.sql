-- requires: power-shapes, realizer, utilities
-- rational_numbers — ported from pg-enumeratio-core_old_backup/sqlsrc/rational-numbers.sql. The old file authored
-- the rationals as (numerator, denominator) with a private base composite + two domain layers (fractional_number
-- unreduced, rational_number reduced/coprime) and enumerated ℚ⁺ via the Calkin-Wilf sequence (Newman's map:
-- aₙ₊₁ = 1/(2⌊aₙ⌋+1 − aₙ), a₀=1), a bijection ℕ → ℚ⁺ where consecutive numerator/denominator pairs are Stern's
-- diatomic sequence. New model: a single plain composite carrier `rational_number` (no domain/CHECK layer — validity
-- is a construction/floor invariant, same as every other carrier in this codebase), an unbounded/ungraded
-- base_collection whose floor emits the Calkin-Wilf sequence in order.

-- ── carrier: reduced (numerator, denominator) pair; sign lives in the numerator, denominator > 0 ──────────
CREATE TYPE rational_number AS (numerator int, denominator int);

CREATE FUNCTION rational_number(num int, den int) RETURNS rational_number LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE g int; s int := CASE WHEN den < 0 THEN -1 ELSE 1 END;
  BEGIN
    g := gcd_int(num, den); IF g = 0 THEN g := 1; END IF;
    RETURN ROW(s * div(num::numeric, g::numeric)::int, s * div(den::numeric, g::numeric)::int)::rational_number;   -- reduce, sign to numerator
  END
$$;

CREATE FUNCTION notation(q rational_number) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (q).denominator = 1 THEN (q).numerator::text ELSE (q).numerator::text || '/' || (q).denominator::text END
$$;

CREATE FUNCTION reciprocal(q rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (q).numerator = 0 THEN NULL
    WHEN (q).numerator > 0 THEN ROW((q).denominator,  (q).numerator)::rational_number
    ELSE                        ROW(-(q).denominator, -(q).numerator)::rational_number END   -- keep sign in the numerator
$$;

-- ── field arithmetic (+, −, ·, ⁻¹); the constructor reduces so every result stays canonical ────────────────
CREATE FUNCTION rational_add(a rational_number, b rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT rational_number((a).numerator * (b).denominator + (b).numerator * (a).denominator, (a).denominator * (b).denominator) $$;
CREATE FUNCTION rational_mul(a rational_number, b rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT rational_number((a).numerator * (b).numerator, (a).denominator * (b).denominator) $$;
CREATE FUNCTION rational_neg(a rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(-(a).numerator, (a).denominator)::rational_number $$;
CREATE FUNCTION rational_sub(a rational_number, b rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT rational_add(a, rational_neg(b)) $$;
CREATE OPERATOR + (LEFTARG = rational_number, RIGHTARG = rational_number, FUNCTION = rational_add, COMMUTATOR = +);
CREATE OPERATOR * (LEFTARG = rational_number, RIGHTARG = rational_number, FUNCTION = rational_mul, COMMUTATOR = *);
CREATE OPERATOR - (LEFTARG = rational_number, RIGHTARG = rational_number, FUNCTION = rational_sub);
CREATE OPERATOR - (RIGHTARG = rational_number, FUNCTION = rational_neg);   -- unary negation
CREATE FUNCTION rational_lt(a rational_number, b rational_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (a).numerator * (b).denominator < (b).numerator * (a).denominator $$;   -- denominators are > 0
CREATE FUNCTION rational_le(a rational_number, b rational_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (a).numerator * (b).denominator <= (b).numerator * (a).denominator $$;
-- (no < operator: rational_number's composite default record-comparison would collide. The functions suffice.)

-- ── the Calkin-Wilf enumeration of ℚ⁺ ──────────────────────────────────────────────────────────────────
CREATE FUNCTION next_calkin_wilf(q rational_number) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((q).denominator,
             (2 * div((q).numerator::numeric, (q).denominator::numeric)::int + 1) * (q).denominator - (q).numerator
        )::rational_number
$$;

CREATE TYPE rational_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)

-- FLOOR: the first element_limit Calkin-Wilf terms, in order (a₀=1, then Newman's map). Ungraded ⇒ the whole
-- sequence lives in the single fiber.
CREATE FUNCTION fiber_elements(f rational_numbers_fiber, element_limit int) RETURNS SETOF rational_number LANGUAGE sql STABLE AS $$
  WITH RECURSIVE seq(numerator, denominator, i) AS (
      SELECT 1, 1, 0
    UNION ALL
      SELECT s.denominator,
             (2 * div(s.numerator::numeric, s.denominator::numeric)::int + 1) * s.denominator - s.numerator,
             s.i + 1
      FROM seq s WHERE s.i + 1 < element_limit
  )
  SELECT ROW(numerator, denominator)::rational_number FROM seq ORDER BY i LIMIT element_limit
$$;

-- contains: v is some Calkin-Wilf term iff it's a positive rational already in lowest terms (the sequence is a
-- bijection onto exactly those pairs).
CREATE FUNCTION contains_in_fiber(f rational_numbers_fiber, v rational_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).numerator > 0 AND (v).denominator > 0 AND gcd_int((v).numerator, (v).denominator) = 1
$$;

-- declare it as DATA + realize (unbounded, no grades: cardinality = ∞, anchor via elements() not cardinality)
INSERT INTO base_collection VALUES ('rational_numbers', 'rational_number', true);
CREATE FUNCTION fiber_symbol(f rational_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℚ' $$;   -- corpus symbol
SELECT base_realize('rational_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('rational_numbers', 'rational_number() reduces to lowest terms; sign to the numerator; 0 ⇒ 0/1', 'eq', '3/2 -3/2 0', '', $q$
    SELECT notation(rational_number(6,4)) || ' ' || notation(rational_number(-6,4)) || ' ' || notation(rational_number(0,5))
  $q$),

  ('rational_numbers', 'reciprocal keeps the sign in the numerator', 'eq', '2/3 -2/3', '1/(±3/2) = ±2/3.', $q$
    SELECT notation(reciprocal(rational_number(3,2))) || ' ' || notation(reciprocal(rational_number(-3,2)))
  $q$),

  ('rational_numbers', 'the Calkin-Wilf sequence', 'eq', '1,1/2,2,1/3,3/2,2/3,3', 'a₀=1, then Newman''s map walks every positive rational once.', $q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(rational_numbers(), 7) e
  $q$),

  ('rational_numbers', 'every Calkin-Wilf term is reduced and positive', 'eq', 'true', 'Calkin-Wilf yields each ℚ⁺ in lowest terms.', $q$
    SELECT bool_and(((e).value).numerator > 0 AND gcd_int(((e).value).numerator, ((e).value).denominator) = 1)::text
    FROM elements(rational_numbers(), 60) e
  $q$),

  ('rational_numbers', 'consecutive terms share num/den (Stern)', 'ok', NULL, 'aₙ''s denominator = aₙ₊₁''s numerator — the Stern-Brocot/fusc structure.', $q$
    DO $do$ DECLARE r int; BEGIN
      FOR r IN 0..40 LOOP
        ASSERT ((unrank(rational_numbers(), r)).value).denominator = ((unrank(rational_numbers(), r+1)).value).numerator, 'stern @'||r;
      END LOOP;
    END $do$
  $q$),

  ('rational_numbers', 'Calkin-Wilf hits distinct rationals', 'eq', '100', 'No repeats in the first 100 — it is a bijection.', $q$
    SELECT count(DISTINCT notation((e).value))::text FROM elements(rational_numbers(), 100) e
  $q$),

  ('rational_numbers', 'contains: 3/2 (reduced) ∈ ℚ⁺, 6/4 (unreduced) ∉', 'eq', 'true|false', 'contains checks reduced + positive, via <@.', $q$
    SELECT (ROW(3,2)::rational_number <@ rational_numbers())::text || '|' || (ROW(6,4)::rational_number <@ rational_numbers())::text
  $q$),

  ('rational_numbers', 'infinite overall', 'eq', 'Infinity', 'Countably many rationals.', $q$
    SELECT cardinality(rational_numbers())::text
  $q$);
