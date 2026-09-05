-- requires: realizer, fractional_numbers
-- gaussian_fractionals = { p + qi } carried as a (re, im) pair of UNREDUCED fractional_numbers — the unreduced
-- companion to gaussian_rationals, standing to it as fractional_numbers stands to rational_numbers: the pair of
-- pairs is the object, so (1/2)+(1/2)i and (2/4)+(3/6)i are different elements. Same Cantor construction as
-- gaussian_rationals, but the per-coordinate index is fractional_numbers — already signed over all of ℤ×ℕ⁺, so no
-- extra zigzag is needed. The floor borrows fractional_numbers' Cantor enumeration through unrank. Unbounded, one
-- infinite fiber.
CREATE TYPE gaussian_fractional AS (re fractional_number, im fractional_number);

-- render q·i as a term (q an unreduced fraction): 'i' only for the literal 1/1, '-i' for -1/1 — 2/2 stays '2/2i';
-- joined ⇒ prefix an explicit '+' for q>0.
CREATE FUNCTION gaussian_fractional_im(q fractional_number, joined boolean) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN (q).numerator =  1 AND (q).denominator = 1 THEN CASE WHEN joined THEN '+i' ELSE 'i' END
    WHEN (q).numerator = -1 AND (q).denominator = 1 THEN '-i'
    WHEN (q).numerator > 0                          THEN CASE WHEN joined THEN '+' ELSE '' END || notation(q) || 'i'
    ELSE                                                 notation(q) || 'i'          -- notation already carries the '-'
  END $$;
CREATE FUNCTION notation(g gaussian_fractional) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN ((g).im).numerator = 0 THEN notation((g).re)
    WHEN ((g).re).numerator = 0 THEN gaussian_fractional_im((g).im, false)
    ELSE notation((g).re) || gaussian_fractional_im((g).im, true)
  END $$;

CREATE TYPE gaussian_fractionals_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- FLOOR: Cantor(diagonal d, offset i) with re/im the i-th and (d−i)-th fractional_number (borrowed via unrank).
CREATE FUNCTION fiber_elements(f gaussian_fractionals_fiber, element_limit int) RETURNS SETOF gaussian_fractional LANGUAGE sql STABLE AS $$
  SELECT ROW((unrank(fractional_numbers(), i)).value,
             (unrank(fractional_numbers(), d - i)).value)::gaussian_fractional
  FROM generate_series(0, ceil(sqrt(2.0 * greatest(element_limit, 1)))::int + 1) d,   -- diagonals 0..D, D ≳ √(2·limit)
       LATERAL generate_series(0, d) i
  ORDER BY d, i LIMIT element_limit $$;
-- contains: reached iff both coordinates are formal fractions with a positive denominator.
CREATE FUNCTION contains_in_fiber(f gaussian_fractionals_fiber, v gaussian_fractional) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ((v).re).denominator > 0 AND ((v).im).denominator > 0 $$;

INSERT INTO base_collection VALUES ('gaussian_fractionals', 'gaussian_fractional', true);   -- unbounded, ungraded
SELECT base_realize('gaussian_fractionals');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gaussian_fractionals','the enumeration spirals from 0 (first eight)','eq','0,0,0/2,i,0/2,1,0,i','Cantor over the fraction index; display collapses value-equal parts',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(gaussian_fractionals(), 8) e $q$),
  ('gaussian_fractionals','unreduced: (1/2)+(1/2)i and (2/4)+(2/4)i are distinct elements','eq','true','the pair of pairs is the object',$q$
    SELECT (ROW(ROW(1,2), ROW(1,2))::gaussian_fractional <> ROW(ROW(2,4), ROW(2,4))::gaussian_fractional
        AND ROW(ROW(1,2), ROW(1,2))::gaussian_fractional <@ gaussian_fractionals()
        AND ROW(ROW(2,4), ROW(2,4))::gaussian_fractional <@ gaussian_fractionals())::text $q$),
  ('gaussian_fractionals','notation: re + im·i with unreduced parts','eq','1/2+3/4i','p + qi',$q$
    SELECT notation(ROW(ROW(1,2), ROW(3,4))::gaussian_fractional) $q$),
  ('gaussian_fractionals','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(gaussian_fractionals())::text $q$),
  ('gaussian_fractionals','contains: 1/2 + i ∈, but a nonpositive denominator ∉ (via <@)','eq','true|false','both coordinates are formal fractions over ℤ×ℕ⁺',$q$
    SELECT (ROW(ROW(1,2), ROW( 1,1))::gaussian_fractional <@ gaussian_fractionals())::text || '|' ||
           (ROW(ROW(1,2), ROW(1,-1))::gaussian_fractional <@ gaussian_fractionals())::text $q$),
  ('gaussian_fractionals','rank/unrank agree over a prefix','eq','true','unrank(ordinality) recovers the same element',$q$
    SELECT bool_and((unrank(gaussian_fractionals(), ordinality(e)::int)).value = (e).value)::text
    FROM elements(gaussian_fractionals(), 50) e $q$),
  ('gaussian_fractionals','value round-trips: (1/2)+(1/2)i ↦ its position ↦ back','eq','1/2+1/2i','locate the element, unrank its rank, recover it',$q$
    SELECT notation((unrank(gaussian_fractionals(),
             (SELECT ordinality(e)::int FROM elements(gaussian_fractionals(), 200) e
              WHERE (e).value = ROW(ROW(1,2), ROW(1,2))::gaussian_fractional))).value) $q$),
  ('gaussian_fractionals','the first 100 elements are distinct','eq','100','the enumeration is a bijection ℕ → (ℤ×ℕ⁺)²',$q$
    SELECT count(DISTINCT (e).value)::text FROM elements(gaussian_fractionals(), 100) e $q$);
