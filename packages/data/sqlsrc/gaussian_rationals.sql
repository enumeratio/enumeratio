-- requires: realizer, rational_numbers
-- gaussian_rationals ℚ(i) = { p + qi : p, q ∈ ℚ } — the Gaussian rationals, the field of fractions of ℤ[i], carried
-- as a (re, im) pair of reduced rational_numbers. Enumerated by the Cantor diagonal over ℕ² composed with a SIGNED-ℚ
-- index on each coordinate. rational_numbers (Calkin–Wilf) only walks ℚ⁺, so first zigzag it into all of ℚ — 0, then
-- ±(each positive rational) — exactly as integer_numbers zigzags natural_numbers into ℤ; that gives a bijection
-- ℕ → ℚ, and pairing two of them a bijection ℕ → ℚ². The floor borrows rational_numbers' Calkin–Wilf enumeration
-- through unrank (the borrow is manifest here). Unbounded, one infinite fiber.
CREATE TYPE gaussian_rational AS (re rational_number, im rational_number);

-- the signed-ℚ index: 0, +cw(0), −cw(0), +cw(1), −cw(1), … over the Calkin–Wilf enumeration cw of ℚ⁺ (borrowed via
-- unrank(rational_numbers())). A bijection ℕ → ℚ, reduced with the sign in the numerator.
CREATE FUNCTION signed_rational(k int) RETURNS rational_number LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN k = 0     THEN ROW(0, 1)::rational_number
    WHEN k % 2 = 1 THEN            (unrank(rational_numbers(), (k - 1) / 2)).value
    ELSE               rational_neg((unrank(rational_numbers(), (k - 2) / 2)).value)
  END $$;

-- render q·i as a term: 'i' for q=1, '-i' for q=-1, else the fraction + 'i'; joined ⇒ prefix an explicit '+' for q>0.
CREATE FUNCTION gaussian_rational_im(q rational_number, joined boolean) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN (q).numerator =  1 AND (q).denominator = 1 THEN CASE WHEN joined THEN '+i' ELSE 'i' END
    WHEN (q).numerator = -1 AND (q).denominator = 1 THEN '-i'
    WHEN (q).numerator > 0                          THEN CASE WHEN joined THEN '+' ELSE '' END || notation(q) || 'i'
    ELSE                                                 notation(q) || 'i'          -- notation already carries the '-'
  END $$;
CREATE FUNCTION notation(g gaussian_rational) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN ((g).im).numerator = 0 THEN notation((g).re)
    WHEN ((g).re).numerator = 0 THEN gaussian_rational_im((g).im, false)
    ELSE notation((g).re) || gaussian_rational_im((g).im, true)
  END $$;

CREATE TYPE gaussian_rationals_fiber AS (unit unit);   -- singleton fiber (ungraded)
-- FLOOR: Cantor(diagonal d, offset i) with re = signed_rational(i), im = signed_rational(d−i).
CREATE FUNCTION fiber_elements(f gaussian_rationals_fiber, element_limit int) RETURNS SETOF gaussian_rational LANGUAGE sql STABLE AS $$
  SELECT ROW(signed_rational(i), signed_rational(d - i))::gaussian_rational
  FROM generate_series(0, ceil(sqrt(2.0 * greatest(element_limit, 1)))::int + 1) d,   -- diagonals 0..D, D ≳ √(2·limit)
       LATERAL generate_series(0, d) i
  ORDER BY d, i LIMIT element_limit $$;
-- contains: reached iff both coordinates are reduced rationals (the index emits each reduced ℚ exactly once).
CREATE FUNCTION contains_in_fiber(f gaussian_rationals_fiber, v gaussian_rational) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT ((v).re).denominator > 0 AND gcd_int(((v).re).numerator, ((v).re).denominator) = 1
     AND ((v).im).denominator > 0 AND gcd_int(((v).im).numerator, ((v).im).denominator) = 1 $$;

INSERT INTO base_collection VALUES ('gaussian_rationals', 'gaussian_rational', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f gaussian_rationals_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'ℚ(i)' $$;
SELECT base_realize('gaussian_rationals');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gaussian_rationals','the enumeration spirals from 0 (first eight)','eq','0,i,1,-i,1+i,-1,1/2i,1-i','Cantor × signed-ℚ',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(gaussian_rationals(), 8) e $q$),
  ('gaussian_rationals','the signed-ℚ index zigzags ℚ⁺: 0,1,−1,1/2,−1/2,2,−2','eq','0,1,-1,1/2,-1/2,2,-2','0 then ±(Calkin–Wilf)',$q$
    SELECT string_agg(notation(signed_rational(k)), ',' ORDER BY k) FROM generate_series(0,6) k $q$),
  ('gaussian_rationals','notation: re + im·i with rational parts','eq','1/2+3/2i','p + qi',$q$
    SELECT notation(ROW(ROW(1,2), ROW(3,2))::gaussian_rational) $q$),
  ('gaussian_rationals','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(gaussian_rationals())::text $q$),
  ('gaussian_rationals','contains: 1/2 − i ∈ (reduced), but 2/4 + i ∉ (unreduced) — via <@','eq','true|false','both coordinates must be in lowest terms',$q$
    SELECT (ROW(ROW(1,2), ROW(-1,1))::gaussian_rational <@ gaussian_rationals())::text || '|' ||
           (ROW(ROW(2,4), ROW( 1,1))::gaussian_rational <@ gaussian_rationals())::text $q$),
  ('gaussian_rationals','rank/unrank agree over a prefix','eq','true','unrank(ordinality) recovers the same element',$q$
    SELECT bool_and((unrank(gaussian_rationals(), ordinality(e)::int)).value = (e).value)::text
    FROM elements(gaussian_rationals(), 50) e $q$),
  ('gaussian_rationals','value round-trips: 1+i ↦ its position ↦ back to 1+i','eq','1+i','locate the element, unrank its rank, recover it',$q$
    SELECT notation((unrank(gaussian_rationals(),
             (SELECT ordinality(e)::int FROM elements(gaussian_rationals(), 200) e
              WHERE (e).value = ROW(ROW(1,1), ROW(1,1))::gaussian_rational))).value) $q$),
  ('gaussian_rationals','the first 100 elements are distinct','eq','100','the enumeration is a bijection ℕ → ℚ²',$q$
    SELECT count(DISTINCT (e).value)::text FROM elements(gaussian_rationals(), 100) e $q$);
