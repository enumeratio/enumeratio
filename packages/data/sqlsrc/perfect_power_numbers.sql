-- requires: power-shapes, realizer
-- perfect_power_numbers — m^k with k>=2 (A001597): 1,4,8,9,16,25,27,32,36,49,… (gcd of prime exponents >= 2).
CREATE TYPE perfect_power_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f perfect_power_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*element_limit*2+50) n WHERE is_perfect_power(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f perfect_power_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_perfect_power(v) $$;
INSERT INTO base_collection VALUES ('perfect_power_numbers','numeric',true);
SELECT base_realize('perfect_power_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('perfect_power_numbers','first ten','eq','1,4,8,9,16,25,27,32,36,49','m^k, k>=2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(perfect_power_numbers(),10) e $q$),
  ('perfect_power_numbers','contains: 81 ∈ (3^4), 72 ∉ (achilles)','eq','true|false','',$q$ SELECT (81::numeric <@ perfect_power_numbers())::text||'|'||(72::numeric <@ perfect_power_numbers())::text $q$);
