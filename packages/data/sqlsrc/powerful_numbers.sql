-- requires: power-shapes, realizer
-- powerful_numbers — every prime factor appears with exponent >= 2 (A001694): 1,4,8,9,16,25,27,32,36,49,…
CREATE TYPE powerful_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f powerful_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*element_limit*2+50) n WHERE is_powerful(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f powerful_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_powerful(v) $$;
INSERT INTO base_collection VALUES ('powerful_numbers','numeric',true);
SELECT base_realize('powerful_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('powerful_numbers','first ten','eq','1,4,8,9,16,25,27,32,36,49','all exponents >= 2',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(powerful_numbers(),10) e $q$),
  ('powerful_numbers','contains: 72 ∈ (2^3·3^2), 12 ∉','eq','true|false','',$q$ SELECT (72::numeric <@ powerful_numbers())::text||'|'||(12::numeric <@ powerful_numbers())::text $q$);
