-- requires: evil_numbers, number-theory, realizer
-- pernicious_numbers — the binary digit sum (popcount) is prime (A052294): 3,5,6,7,9,10,11,… Reuses binary_popcount + is_prime_number.
CREATE FUNCTION is_pernicious(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n>=1 AND is_prime_number(binary_popcount(n)::numeric) $$;
CREATE TYPE pernicious_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f pernicious_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*2+10) n WHERE is_pernicious(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f pernicious_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_pernicious(v) $$;
INSERT INTO base_collection VALUES ('pernicious_numbers','numeric',true);
SELECT base_realize('pernicious_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('pernicious_numbers','first ten','eq','3,5,6,7,9,10,11,12,13,14','popcount is prime',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(pernicious_numbers(),10) e $q$),
  ('pernicious_numbers','contains: 7 ∈ (popcount 3), 8 ∉ (popcount 1)','eq','true|false','',$q$ SELECT (7::numeric <@ pernicious_numbers())::text||'|'||(8::numeric <@ pernicious_numbers())::text $q$),
  ('pernicious_numbers','overlap: 3 (binary 11, popcount 2) is both evil and pernicious, since 2 is prime and even','eq','true|true','popcount=2 is the only value both even and prime',$q$
    SELECT is_evil(3::numeric)::text || '|' || is_pernicious(3::numeric)::text $q$),
  ('pernicious_numbers','unrank(9) = 14 (the 10th pernicious number)','eq','14','rank 9 (0-based)',$q$
    SELECT (unrank(pernicious_numbers(), 9)).value::text $q$),
  ('pernicious_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(pernicious_numbers())::text $q$);
