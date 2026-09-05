-- requires: aliquot, realizer
-- untouchable_numbers — positive integers that are NOT the aliquot sum of any m, i.e. σ(m) − m ≠ n for all m (A005114):
-- 2,5,52,88,96,120,124,146,162,188,206,210,216,238,246,… 2 is untouchable (nothing has proper-divisor sum 2); 5 is the
-- only conjectured odd one > 1. Deciding membership means proving n is outside the IMAGE of the aliquot map (a sieve
-- over all m), so there is no local predicate — the floor is a literal seed and contains is membership. Unbounded ⇒ ∞.
-- (aliquot_sum from 48-aliquot: n is "touched" iff some m has aliquot_sum(m) = n.)

CREATE FUNCTION untouchable_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[2,5,52,88,96,120,124,146,162,188,206,210,216,238,246,248,262,268,276,288,290,292,304,306,
    322,324,326,336,342,372]::numeric[] $$;

CREATE TYPE untouchable_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f untouchable_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(untouchable_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f untouchable_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(untouchable_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('untouchable_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f untouchable_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Unt' $$;   -- corpus symbol
SELECT base_realize('untouchable_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('untouchable_numbers','first eight via the realized floor','eq','2,5,52,88,96,120,124,146','A005114',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(untouchable_numbers(), 8) e $q$),
  ('untouchable_numbers','the last seven of the window pin the corrected tail (318 & 338 are touched, dropped)','eq','306,322,324,326,336,342,372','A005114',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(untouchable_numbers(), 30) e WHERE ordinality(e) BETWEEN 23 AND 29 $q$),
  ('untouchable_numbers','318 is touched: aliquot_sum(317²) = 318 ⇒ 318 ∉','eq','false|true','318 dropped from the seed, 342 added',$q$
    SELECT (318::numeric <@ untouchable_numbers())::text || '|' || (342::numeric <@ untouchable_numbers())::text $q$),
  ('untouchable_numbers','2 is untouchable: no m ≤ 500 has aliquot_sum = 2','ok',NULL,'outside the image of the aliquot map',$q$
    SELECT NOT bool_or(aliquot_sum(m) = 2) FROM generate_series(1, 500) m $q$),
  ('untouchable_numbers','contains via <@: 5 ∈, 6 ∉ (6 = σ(6) − 6, a perfect number touches itself)','eq','true|false','windowed membership',$q$
    SELECT (5::numeric <@ untouchable_numbers())::text || '|' || (6::numeric <@ untouchable_numbers())::text $q$),
  ('untouchable_numbers','all members except 5 are even (Erdős)','ok',NULL,'parity of the window',$q$
    SELECT bool_and(mod((e).value::int, 2) = 0) FROM elements(untouchable_numbers(), 8) e WHERE (e).value <> 5 $q$);
