-- requires: realizer
-- idoneal_numbers — Euler's "numeri idonei" (A000926): the 65 known n for which every genus of discriminant −4n
-- binary quadratic forms holds exactly one class. 1,2,3,4,5,6,7,8,9,10,12,13,15,… ,1320,1365,1848. At most one more
-- can exist (Weinberger, conditional on GRH), and would be > 10^11 — so this is a literal seed, essentially complete.
-- Bounded ⇒ cardinality = 65. contains is membership in Euler's list.

CREATE FUNCTION idoneal_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[1,2,3,4,5,6,7,8,9,10,12,13,15,16,18,21,22,24,25,28,30,33,37,40,42,45,48,57,58,60,70,72,78,
    85,88,93,102,105,112,120,130,133,165,168,177,190,210,232,240,253,273,280,312,330,345,357,385,408,462,
    520,760,840,1320,1365,1848]::numeric[] $$;

CREATE TYPE idoneal_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f idoneal_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(idoneal_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f idoneal_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(idoneal_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('idoneal_numbers', 'numeric', false);   -- bounded (65 known, essentially complete)
CREATE FUNCTION fiber_symbol(f idoneal_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Idon' $$;   -- corpus symbol
SELECT base_realize('idoneal_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('idoneal_numbers','first fifteen via the realized floor','eq','1,2,3,4,5,6,7,8,9,10,12,13,15,16,18','A000926',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(idoneal_numbers(), 15) e $q$),
  ('idoneal_numbers','cardinality = 65 (Euler''s complete list)','eq','65','bounded',$q$
    SELECT cardinality(idoneal_numbers())::text $q$),
  ('idoneal_numbers','unrank(64) = 1848 (the largest known idoneal number)','eq','1848','rank 64 (0-based), last in the list',$q$
    SELECT (unrank(idoneal_numbers(), 64)).value::text $q$),
  ('idoneal_numbers','contains via <@: 1848 ∈, 11 ∉ (first gap in the list)','eq','true|false','Euler-list membership',$q$
    SELECT (1848::numeric <@ idoneal_numbers())::text || '|' || (11::numeric <@ idoneal_numbers())::text $q$);
