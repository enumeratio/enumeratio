-- requires: power-shapes, realizer
-- sphenic_numbers — products of 3 distinct primes (A007304): 30,42,66,70,78,… (Ω=3 and ω=3).
CREATE TYPE sphenic_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f sphenic_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$ SELECT n::numeric FROM generate_series(2,element_limit*20+200) n WHERE is_sphenic(n::numeric) LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f sphenic_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT is_sphenic(v) $$;
INSERT INTO base_collection VALUES ('sphenic_numbers','numeric',true);
CREATE FUNCTION fiber_symbol(f sphenic_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Sph' $$;   -- corpus symbol
SELECT base_realize('sphenic_numbers');
INSERT INTO base_example (suite,title,kind,expected,description,sql) VALUES
  ('sphenic_numbers','first ten','eq','30,42,66,70,78,102,105,110,114,130','3 distinct primes',$q$ SELECT string_agg((e).value::text,',' ORDER BY ordinality(e)) FROM elements(sphenic_numbers(),10) e $q$),
  ('sphenic_numbers','contains: 30 ∈ (2·3·5), 60 ∉ (2^2·3·5)','eq','true|false','',$q$ SELECT (30::numeric <@ sphenic_numbers())::text||'|'||(60::numeric <@ sphenic_numbers())::text $q$),
  ('sphenic_numbers','decomposed: 30 has big_omega=3, little_omega=3 (3 distinct primes) — checked directly, not via is_sphenic','eq','3|3|true','',$q$
    SELECT big_omega(30)::text || '|' || little_omega(30)::text || '|' || (big_omega(30)=3 AND little_omega(30)=3)::text $q$),
  ('sphenic_numbers','60 = 2^2·3·5 has big_omega=4 ≠ little_omega=3, so not sphenic','eq','4|3|false','',$q$
    SELECT big_omega(60)::text || '|' || little_omega(60)::text || '|' || (big_omega(60)=3 AND little_omega(60)=3)::text $q$);
