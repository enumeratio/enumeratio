-- requires: realizer
-- evil_numbers — nonneg integers with an EVEN number of 1s in binary (A001969): 0,3,5,6,9,10,12,15,… Number set.
CREATE FUNCTION binary_popcount(n numeric) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric:=trunc(n); c int:=0; BEGIN WHILE m>0 LOOP c:=c+mod(m,2)::int; m:=div(m,2); END LOOP; RETURN c; END $$;
CREATE FUNCTION is_evil(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n>=0 AND mod(binary_popcount(n),2)=0 $$;
CREATE TYPE evil_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f evil_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(0, element_limit*2+10) n WHERE is_evil(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f evil_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_evil(v) $$;
INSERT INTO base_collection VALUES ('evil_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f evil_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Evil' $$;   -- corpus symbol
SELECT base_realize('evil_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('evil_numbers','first ten','eq','0,3,5,6,9,10,12,15,17,18','even binary digit sum',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(evil_numbers(),10) e $q$),
  ('evil_numbers','contains: 6 ∈ (110), 7 ∉ (111)','eq','true|false','',$q$ SELECT (6::numeric <@ evil_numbers())::text||'|'||(7::numeric <@ evil_numbers())::text $q$);
