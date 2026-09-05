-- requires: realizer
-- automorphic_numbers — n^2 ends in n (A003226): 0,1,5,6,25,76,376,625,… Number set.
CREATE FUNCTION is_automorphic(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT n>=0 AND mod(n*n, ('1'||repeat('0', length(trunc(n)::text)))::numeric) = n $$;   -- last d digits of n^2 equal n
CREATE TYPE automorphic_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f automorphic_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(0,element_limit*element_limit*50+100) n WHERE is_automorphic(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f automorphic_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_automorphic(v) $$;
INSERT INTO base_collection VALUES ('automorphic_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f automorphic_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Autom' $$;   -- corpus symbol
SELECT base_realize('automorphic_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('automorphic_numbers','first six','eq','0,1,5,6,25,76','n^2 ends in n',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(automorphic_numbers(),6) e $q$),
  ('automorphic_numbers','contains: 76 ∈ (76^2=5776), 7 ∉','eq','true|false','',$q$ SELECT (76::numeric <@ automorphic_numbers())::text||'|'||(7::numeric <@ automorphic_numbers())::text $q$);
