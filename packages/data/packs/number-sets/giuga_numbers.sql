-- requires: number-theory, realizer
-- giuga_numbers — composite n where p | (n/p − 1) for every prime p | n (A007850): 30,858,1722,66198,2214408306,…
-- All known are squarefree and even; only 14 are known (7 ≤ MAX_SAFE_INTEGER). A literal seed of those 7 — the larger
-- ones (≈ 4×10^14) are beyond cheap trial-factorization, so contains is membership in the known set rather than a live
-- factor test. Bounded ⇒ cardinality = 7.

CREATE FUNCTION giuga_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[30,858,1722,66198,2214408306,24423128562,432749205173838]::numeric[] $$;

CREATE TYPE giuga_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f giuga_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(giuga_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f giuga_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(giuga_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('giuga_numbers', 'numeric', false);   -- bounded (7 known within range), ungraded
CREATE FUNCTION fiber_symbol(f giuga_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Giuga' $$;   -- corpus symbol
SELECT base_realize('giuga_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('giuga_numbers','the seven within range via the realized floor','eq','30,858,1722,66198,2214408306,24423128562,432749205173838','A007850 ≤ MAX_SAFE_INTEGER',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(giuga_numbers(), 20) e $q$),
  ('giuga_numbers','cardinality = 7 (finite within range)','eq','7','bounded',$q$
    SELECT cardinality(giuga_numbers())::text $q$),
  ('giuga_numbers','contains via <@: 30 ∈ (2·3·5, smallest), 60 ∉','eq','true|false','known-set membership',$q$
    SELECT (30::numeric <@ giuga_numbers())::text || '|' || (60::numeric <@ giuga_numbers())::text $q$),
  ('giuga_numbers','the Giuga condition p | (n/p − 1) holds for every prime factor of 30','ok',NULL,'2|14, 3|9, 5|5',$q$
    SELECT bool_and(mod(30 / p - 1, p) = 0) FROM unnest((factorize(30)).primes) p $q$);
