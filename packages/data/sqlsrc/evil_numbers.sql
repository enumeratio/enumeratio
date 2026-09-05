-- requires: realizer, utilities
-- evil_numbers — nonneg integers with an EVEN number of 1s in binary (A001969): 0,3,5,6,9,10,12,15,… Number set.
-- binary_popcount lives in utilities.sql (shared with k_bounded_compositions).
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
  ('evil_numbers','contains: 6 ∈ (110), 7 ∉ (111)','eq','true|false','',$q$ SELECT (6::numeric <@ evil_numbers())::text||'|'||(7::numeric <@ evil_numbers())::text $q$),
  ('evil_numbers','decomposed: binary_popcount(9)=2 (1001), even — checked directly, not via is_evil','eq','2|true','',$q$
    SELECT binary_popcount(9)::text || '|' || (mod(binary_popcount(9),2)=0)::text $q$),
  ('evil_numbers','unrank(9) = 18 (the 10th evil number)','eq','18','rank 9 (0-based)',$q$
    SELECT (unrank(evil_numbers(), 9)).value::text $q$),
  ('evil_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(evil_numbers())::text $q$);
