-- requires: aliquot, realizer
-- semiperfect_numbers — n equal to the sum of SOME subset of its proper divisors (A005835): 6,12,18,20,24,28,30,36,40,
-- 42,48,54,56,60,… Every perfect number is semiperfect (all proper divisors sum to n) and every multiple of a
-- semiperfect number is semiperfect. Membership is a subset-sum decision, so the floor is a literal seed of the initial
-- window and contains is membership in it. Unbounded ⇒ ∞. Semiperfect ⊔ weird partitions the abundant numbers.

CREATE FUNCTION semiperfect_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[6,12,18,20,24,28,30,36,40,42,48,54,56,60,66,72,78,80,84,88,90,96,100,102,104,108,112,114,120,
    126,132,138,140,144,150,156,160,162,168]::numeric[] $$;

CREATE TYPE semiperfect_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f semiperfect_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(semiperfect_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f semiperfect_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(semiperfect_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('semiperfect_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f semiperfect_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SP' $$;   -- corpus symbol
SELECT base_realize('semiperfect_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semiperfect_numbers','first twelve via the realized floor','eq','6,12,18,20,24,28,30,36,40,42,48,54','A005835',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(semiperfect_numbers(), 12) e $q$),
  ('semiperfect_numbers','every member is non-deficient (aliquot_sum ≥ n)','ok',NULL,'a necessary condition for semiperfect',$q$
    SELECT bool_and(aliquot_sum((e).value) >= (e).value) FROM elements(semiperfect_numbers(), 12) e $q$),
  ('semiperfect_numbers','contains via <@: 6 ∈ (1+2+3, also perfect), 70 ∉ (abundant but weird)','eq','true|false','windowed membership',$q$
    SELECT (6::numeric <@ semiperfect_numbers())::text || '|' || (70::numeric <@ semiperfect_numbers())::text $q$),
  ('semiperfect_numbers','contains via <@: 20 ∈ (1+4+5+10), 8 ∉ (deficient: 1+2+4 < 8)','eq','true|false','a subset must sum to n',$q$
    SELECT (20::numeric <@ semiperfect_numbers())::text || '|' || (8::numeric <@ semiperfect_numbers())::text $q$);
