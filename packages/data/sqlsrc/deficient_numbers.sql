-- requires: aliquot, realizer
-- deficient_numbers — aliquot_sum(n) < n (is_deficient_number from 48-aliquot). Ungraded/∞ number set (dense).
CREATE TYPE deficient_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f deficient_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT n::numeric FROM generate_series(1, element_limit*2+10) n WHERE is_deficient_number(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f deficient_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_deficient_number(v) $$;
INSERT INTO base_collection VALUES ('deficient_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f deficient_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Def' $$;   -- corpus symbol
SELECT base_realize('deficient_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('deficient_numbers','first ten','eq','1,2,3,4,5,7,8,9,10,11','aliquot < n',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(deficient_numbers(),10) e $q$),
  ('deficient_numbers','contains: 8 ∈, 12 ∉ (abundant)','eq','true|false','',$q$ SELECT (8::numeric <@ deficient_numbers())::text||'|'||(12::numeric <@ deficient_numbers())::text $q$),
  ('deficient_numbers','aliquot_sum(21) = 11 (1+3+7), so 21 is deficient','eq','11|true','decomposed via aliquot_sum, not is_deficient_number',$q$
    SELECT aliquot_sum(21)::text || '|' || (aliquot_sum(21) < 21)::text $q$),
  ('deficient_numbers','every prime p has aliquot_sum(p) = 1 < p, hence deficient','eq','true','decomposed cross-check over several primes',$q$
    SELECT bool_and(aliquot_sum(p::numeric) = 1 AND aliquot_sum(p::numeric) < p)::text FROM (VALUES (2),(3),(5),(7),(11),(97)) t(p) $q$);
