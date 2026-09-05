-- requires: realizer
-- lucky_numbers — survivors of Ulam's positional sieve (A000959): start from the odd numbers; the 2nd survivor is 3, so
-- strike every 3rd; the next survivor is 7, so strike every 7th; and so on. 1,3,7,9,13,15,21,25,31,33,37,43,… Same
-- asymptotic density x/ln x as the primes. The sieve acts on POSITIONS, not values, so there is no cheap per-value
-- predicate — the floor is a literal seed of the initial window and contains is membership in it. Unbounded ⇒ ∞.

CREATE FUNCTION lucky_numbers_seed() RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[1,3,7,9,13,15,21,25,31,33,37,43,49,51,63,67,69,73,75,79,87,93,99,105,111,115,127,129,133,135,
    141,151,159,163,169,171,189,193,195,201]::numeric[] $$;

CREATE TYPE lucky_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f lucky_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT v FROM unnest(lucky_numbers_seed()) WITH ORDINALITY AS t(v, o) ORDER BY o LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f lucky_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT v = ANY(lucky_numbers_seed()) $$;

INSERT INTO base_collection VALUES ('lucky_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f lucky_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Lucky' $$;   -- corpus symbol
SELECT base_realize('lucky_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lucky_numbers','first twelve via the realized floor','eq','1,3,7,9,13,15,21,25,31,33,37,43','A000959',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(lucky_numbers(), 12) e $q$),
  ('lucky_numbers','unrank(0) = 1, unrank(3) = 9 (a composite lucky number)','eq','1|9','luckies include composites',$q$
    SELECT (unrank(lucky_numbers(), 0)).value::text || '|' || (unrank(lucky_numbers(), 3)).value::text $q$),
  ('lucky_numbers','contains via <@: 7 ∈ (a lucky prime), 5 ∉ (struck at step 3)','eq','true|false','windowed membership',$q$
    SELECT (7::numeric <@ lucky_numbers())::text || '|' || (5::numeric <@ lucky_numbers())::text $q$);
