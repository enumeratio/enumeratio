-- requires: fibonacci, polygonal_numbers, realizer
-- triangular_numbers — UNGRADED / infinite (carrier numeric), like fibonacci/primes: one empty-address fiber,
-- unbounded ⇒ cardinality = ∞. Floor = T(r) = r·(r+1)/2 (div for exact halving). contains is rank-agnostic:
-- n is triangular iff 8n+1 is a perfect square. Reuses is_perfect_square from the fibonacci floor.

CREATE FUNCTION triangular_number(r int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT div(r::numeric*(r+1), 2) $$;

CREATE TYPE triangular_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f triangular_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT triangular_number(r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f triangular_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_perfect_square(8*v + 1) $$;   -- n is triangular iff 8n+1 is a perfect square

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f triangular_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT triangular_number(rank::int) $fu$;
INSERT INTO base_collection VALUES ('triangular_numbers', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('triangular_numbers');
INSERT INTO base_family_point (collection, family, bindings) VALUES ('triangular_numbers','polygonal_numbers','{"k": 3}');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangular_numbers','first terms via the realized floor','eq','0,1,3,6,10,15,21,28,36','elements over the one infinite fiber (r=0..8)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(triangular_numbers(), 9) e $q$),
  ('triangular_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(triangular_numbers()) f LIMIT 1) FROM fibers(triangular_numbers()) $q$),
  ('triangular_numbers','unrank(10) = 55 = T(10)','eq','55','off the floor',$q$
    SELECT (unrank(triangular_numbers(), 10)).value::text $q$),
  ('triangular_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(triangular_numbers())::text $q$),
  ('triangular_numbers','contains is rank-agnostic: 21 ∈, 22 ∉ (via <@)','eq','true|false','generated contains + operator (8n+1 square)',$q$
    SELECT (21::numeric <@ triangular_numbers())::text || '|' || (22::numeric <@ triangular_numbers())::text $q$),
  ('triangular_numbers','locate: value→element inverse, 10 = T(4)','eq','4','rank(locate(h, v))',$q$
    SELECT rank(locate(triangular_numbers(), 10))::text $q$),
  ('triangular_numbers','locate then next steps to the following term (T(5) = 15)','eq','15','locate composes with next',$q$
    SELECT ((next(locate(triangular_numbers(), 10))).value)::text $q$);
