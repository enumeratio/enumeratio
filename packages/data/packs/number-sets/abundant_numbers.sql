-- requires: aliquot, realizer
-- abundant_numbers — an ungraded / infinite number SET (carrier numeric), sibling of semiprime/perfect numbers.
-- An abundant number has aliquot_sum(n) > n, i.e. its proper divisors sum to more than itself (is_abundant_number
-- from 48-aliquot). The floor scans naturals and keeps the abundant ones ascending; contains is the same predicate.
-- No base_grade rows (ungraded); unbounded ⇒ cardinality = ∞.

CREATE TYPE abundant_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f abundant_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  -- density ≈ 0.2476 (n-th abundant ≈ 4n), but the first is 12 — the +100 floor keeps tiny windows from underflowing
  SELECT n::numeric FROM generate_series(1, element_limit * 8 + 100) n WHERE is_abundant_number(n::numeric) ORDER BY n LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f abundant_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_abundant_number(v) $$;

INSERT INTO base_collection VALUES ('abundant_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f abundant_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Abn' $$;   -- corpus symbol
SELECT base_realize('abundant_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('abundant_numbers','first ten via the realized floor','eq','12,18,20,24,30,36,40,42,48,54','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(abundant_numbers(), 10) e $q$),
  ('abundant_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(abundant_numbers()) f LIMIT 1) FROM fibers(abundant_numbers()) $q$),
  ('abundant_numbers','unrank(6) = 40 (the 7th abundant)','eq','40','rank 6 (0-based)',$q$
    SELECT (unrank(abundant_numbers(), 6)).value::text $q$),
  ('abundant_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(abundant_numbers())::text $q$),
  ('abundant_numbers','contains via <@: 12 ∈ (1+2+3+4+6=16>12), 16 ∉ (1+2+4+8=15<16)','eq','true|false','is_abundant_number',$q$
    SELECT (12::numeric <@ abundant_numbers())::text || '|' || (16::numeric <@ abundant_numbers())::text $q$),
  ('abundant_numbers','abundant ⇔ aliquot_sum(n) > n; least is 12','eq','12','the predicate as an aliquot-sum constraint',$q$
    SELECT min(n)::text FROM generate_series(1,60) n WHERE is_abundant_number(n) $q$);
