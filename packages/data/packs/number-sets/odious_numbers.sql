-- requires: evil_numbers, realizer
-- odious_numbers — nonneg integers with an ODD number of 1s in binary (A000069): 1,2,4,7,8,11,… (complement of
-- evil). Reuses binary_popcount from 86-evil-numbers. Number set.
CREATE FUNCTION is_odious(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n>=1 AND mod(binary_popcount(n),2)=1 $$;
CREATE TYPE odious_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f odious_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(1,element_limit*2+10) n WHERE is_odious(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f odious_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_odious(v) $$;
INSERT INTO base_collection VALUES ('odious_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f odious_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Odi' $$;   -- corpus symbol
SELECT base_realize('odious_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('odious_numbers','first ten','eq','1,2,4,7,8,11,13,14,16,19','odd binary digit sum',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(odious_numbers(),10) e $q$),
  ('odious_numbers','contains: 7 ∈ (111), 6 ∉ (110)','eq','true|false','',$q$ SELECT (7::numeric <@ odious_numbers())::text||'|'||(6::numeric <@ odious_numbers())::text $q$),
  ('odious_numbers','complement: every n in 0..100 is evil XOR odious (popcount parity partitions ℕ)','eq','true','',$q$
    SELECT bool_and(is_evil(n::numeric) <> is_odious(n::numeric))::text FROM generate_series(0,100) n $q$),
  ('odious_numbers','unrank(9) = 19 (the 10th odious number)','eq','19','rank 9 (0-based)',$q$
    SELECT (unrank(odious_numbers(), 9)).value::text $q$),
  ('odious_numbers','cardinality = infinity','eq','Infinity','unbounded',$q$
    SELECT cardinality(odious_numbers())::text $q$);
