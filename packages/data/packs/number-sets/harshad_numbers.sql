-- requires: utilities, realizer
-- harshad_numbers (Niven) — n divisible by its decimal digit sum (A005349): 1..10,12,18,20,21,… Number set.
-- decimal_digit_sum lives in utilities.sql (shared with number.stats + smith_numbers, both cross-pack).
CREATE FUNCTION is_harshad(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n>=1 AND decimal_digit_sum(n)>0 AND mod(n, decimal_digit_sum(n))=0 $$;
CREATE TYPE harshad_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f harshad_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*3+20) n WHERE is_harshad(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f harshad_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_harshad(v) $$;
INSERT INTO base_collection VALUES ('harshad_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f harshad_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Harsh' $$;   -- corpus symbol
SELECT base_realize('harshad_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('harshad_numbers','first twelve','eq','1,2,3,4,5,6,7,8,9,10,12,18','n % digitsum(n) = 0',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(harshad_numbers(),12) e $q$),
  ('harshad_numbers','contains: 18 ∈ (1+8=9|18), 19 ∉','eq','true|false','',$q$ SELECT (18::numeric <@ harshad_numbers())::text||'|'||(19::numeric <@ harshad_numbers())::text $q$),
  ('harshad_numbers','powers of ten are harshad: digit sum = 1 divides everything','eq','true','decomposed via decimal_digit_sum, not is_harshad',$q$
    SELECT bool_and(decimal_digit_sum(p::numeric) = 1)::text FROM (VALUES (10),(100),(1000),(10000)) t(p) $q$),
  ('harshad_numbers','unrank(11) = 18 (the 12th harshad number)','eq','18','rank 11 (0-based)',$q$
    SELECT (unrank(harshad_numbers(), 11)).value::text $q$),
  ('harshad_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(harshad_numbers())::text $q$);
