-- requires: aliquot, realizer
-- weird_numbers — abundant but NOT semiperfect: σ(n) > 2n yet no subset of the proper divisors sums to n (A006037):
-- 70,836,4030,5830,7192,7912,9272,10430,… All known weird numbers are even (Erdős offered $10 for an odd one). The
-- abundance test is cheap (aliquot_sum > n) but the "no subset sums to n" half is a subset-sum decision, so the floor is
-- a literal seed and contains is membership. Unbounded ⇒ ∞. Weird ⊔ semiperfect partitions the abundant numbers.

CREATE FUNCTION weird_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[70,836,4030,5830,7192,7912,9272,10430,10570,10792,10990,11410,11690,12110,12530]::numeric[] $$;

CREATE TYPE weird_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f weird_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(weird_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f weird_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(weird_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('weird_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f weird_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Weird' $$;   -- corpus symbol
SELECT base_realize('weird_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weird_numbers','first six via the realized floor','eq','70,836,4030,5830,7192,7912','A006037',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(weird_numbers(), 6) e $q$),
  ('weird_numbers','every member is abundant (σ(n) > 2n, i.e. aliquot_sum > n)','ok',NULL,'weird ⇒ abundant',$q$
    SELECT bool_and(aliquot_sum((e).value) > (e).value) FROM elements(weird_numbers(), 6) e $q$),
  ('weird_numbers','contains via <@: 70 ∈ (smallest weird), 12 ∉ (abundant but semiperfect: 2+4+6)','eq','true|false','windowed membership',$q$
    SELECT (70::numeric <@ weird_numbers())::text || '|' || (12::numeric <@ weird_numbers())::text $q$);
