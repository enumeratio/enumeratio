-- requires: aliquot, realizer
-- perfect_numbers — an ungraded / infinite number SET (carrier numeric), a sibling of prime_numbers. A perfect
-- number equals the sum of its proper divisors, i.e. aliquot_sum(n) = n (is_perfect_number, from 48-aliquot).
-- Perfect numbers are extremely SPARSE (6, 28, 496, 8128, then 33_550_336), so the floor scans a generous fixed
-- bound and streams (no ORDER BY — generate_series is already ascending) so LIMIT short-circuits once enough
-- matches are found. contains is the same predicate. No base_grade rows (ungraded); unbounded ⇒ cardinality = ∞.

CREATE TYPE perfect_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f perfect_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  -- scan a generous bound (10000 covers 6,28,496,8128); stream in ascending order and stop after element_limit hits
  SELECT n::numeric FROM generate_series(1, 10000) n WHERE is_perfect_number(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f perfect_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_perfect_number(v) $$;

INSERT INTO base_collection VALUES ('perfect_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f perfect_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Perf' $$;   -- corpus symbol
SELECT base_realize('perfect_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_numbers','first four via the realized floor','eq','6,28,496,8128','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(perfect_numbers(), 4) e $q$),
  ('perfect_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(perfect_numbers()) f LIMIT 1) FROM fibers(perfect_numbers()) $q$),
  ('perfect_numbers','unrank(2) = 496 (the 3rd perfect number)','eq','496','rank 2 (0-based)',$q$
    SELECT (unrank(perfect_numbers(), 2)).value::text $q$),
  ('perfect_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(perfect_numbers())::text $q$),
  ('perfect_numbers','contains via <@: 28 ∈, 12 ∉ (abundant)','eq','true|false','is_perfect_number, not merely non-deficient',$q$
    SELECT (28::numeric <@ perfect_numbers())::text || '|' || (12::numeric <@ perfect_numbers())::text $q$),
  ('perfect_numbers','perfect ⇔ aliquot_sum = n; least is 6 = 1+2+3','eq','6','the predicate as an aliquot-sum fixed point',$q$
    SELECT min(n)::text FROM generate_series(2,30) n WHERE is_perfect_number(n) $q$);
