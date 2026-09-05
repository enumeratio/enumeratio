-- requires: realizer
-- fractional_numbers — the UNREDUCED fractions: formal (numerator, denominator) pairs over ℤ × ℕ⁺. Distinct from
-- rational_numbers (reduced ℚ, Calkin–Wilf order): here 1/2, 2/4, 3/6 are three different elements — the pair is the
-- object, not the value it names. Enumerated by the Cantor diagonal over ℕ² with the numerator index run through the
-- ℕ↔ℤ zigzag (0,+1,−1,…) and the denominator index shifted into ℕ⁺ (d−i ↦ d−i+1) — a bijection ℕ → ℤ×ℕ⁺, so a
-- finite prefix spirals out from 0/1. Unbounded, one infinite fiber. (The natural presentation is the 2-D lattice
-- picker over the fraction grid; this linear order just makes it a valid collection.)
CREATE TYPE fractional_number AS (numerator int, denominator int);

CREATE FUNCTION notation(f fractional_number) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).denominator = 1 THEN (f).numerator::text
              ELSE (f).numerator::text || '/' || (f).denominator::text END $$;   -- kept unreduced: 2/4 stays 2/4

CREATE TYPE fractional_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- FLOOR: Cantor(zigzag) — diagonal d, offset i; numerator = zigzag(i) over ℤ, denominator = (d−i)+1 over ℕ⁺.
CREATE FUNCTION fiber_elements(f fractional_numbers_fiber, element_limit int) RETURNS SETOF fractional_number LANGUAGE sql STABLE AS $$
  SELECT ROW(
           CASE WHEN i = 0 THEN 0 WHEN i % 2 = 1 THEN (i + 1) / 2 ELSE -(i / 2) END,   -- numerator = zigzag(i): 0,+1,−1,…
           (d - i) + 1                                                                 -- denominator = (d−i) shifted into ℕ⁺
         )::fractional_number
  FROM generate_series(0, ceil(sqrt(2.0 * greatest(element_limit, 1)))::int + 1) d,    -- diagonals 0..D, D ≳ √(2·limit)
       LATERAL generate_series(0, d) i
  ORDER BY d, i LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f fractional_numbers_fiber, v fractional_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).denominator > 0 $$;                       -- every formal fraction with a positive denominator is reached once

INSERT INTO base_collection VALUES ('fractional_numbers', 'fractional_number', true);   -- unbounded, ungraded
SELECT base_realize('fractional_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fractional_numbers','the fraction grid spirals from 0/1 (first eight)','eq','0,0/2,1,0/3,1/2,-1,0/4,1/3','Cantor × zigzag over ℤ×ℕ⁺',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(fractional_numbers(), 8) e $q$),
  ('fractional_numbers','unreduced: 1/2 and 2/4 are distinct elements','eq','true','the pair is the object, not its value',$q$
    SELECT (ROW(1,2)::fractional_number <> ROW(2,4)::fractional_number
        AND ROW(1,2)::fractional_number <@ fractional_numbers()
        AND ROW(2,4)::fractional_number <@ fractional_numbers())::text $q$),
  ('fractional_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(fractional_numbers())::text $q$),
  ('fractional_numbers','contains: 3/4 ∈, but a nonpositive denominator ∉ (via <@)','eq','true|false','the carrier is ℤ×ℕ⁺',$q$
    SELECT (ROW(3,4)::fractional_number <@ fractional_numbers())::text || '|' ||
           (ROW(3,-4)::fractional_number <@ fractional_numbers())::text $q$),
  ('fractional_numbers','rank/unrank agree over a prefix','eq','true','unrank(ordinality) recovers the same element',$q$
    SELECT bool_and((unrank(fractional_numbers(), ordinality(e)::int)).value = (e).value)::text
    FROM elements(fractional_numbers(), 50) e $q$),
  ('fractional_numbers','value round-trips: 2/4 ↦ its position ↦ back to 2/4','eq','2/4','locate the element, unrank its rank, recover the pair',$q$
    SELECT notation((unrank(fractional_numbers(),
             (SELECT ordinality(e)::int FROM elements(fractional_numbers(), 200) e
              WHERE (e).value = ROW(2,4)::fractional_number))).value) $q$),
  ('fractional_numbers','the first 100 formal fractions are distinct','eq','100','the enumeration is a bijection ℕ → ℤ×ℕ⁺',$q$
    SELECT count(DISTINCT notation((e).value))::text FROM elements(fractional_numbers(), 100) e $q$);
