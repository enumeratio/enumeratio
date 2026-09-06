-- requires: fibonacci, polygonal_numbers, realizer
-- square_numbers — UNGRADED / infinite (carrier numeric), like fibonacci/triangular: one empty-address fiber,
-- unbounded ⇒ cardinality = ∞. Floor = S(r) = r². contains is rank-agnostic: n is a square iff trunc(√n)² = n.
-- Reuses is_perfect_square from the fibonacci floor.

CREATE FUNCTION square_number(r term_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT r::numeric * r $$;

CREATE TYPE square_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f square_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT square_number(r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f square_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_perfect_square(v) $$;   -- n is a square iff trunc(√n)² = n

-- direct unrank (capability layer 3): the ord-th square IS ord² — O(1), no iterating.
CREATE FUNCTION fiber_unrank(f square_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT square_number(rank::term_index) $$;
INSERT INTO base_collection VALUES ('square_numbers', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('square_numbers');
INSERT INTO base_family_point (collection, family, bindings) VALUES ('square_numbers','polygonal_numbers','{"k": 4}');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('square_numbers','first terms via the realized floor','eq','0,1,4,9,16,25,36,49,64','elements over the one infinite fiber (r=0..8)',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(square_numbers(), 9) e $q$),
  ('square_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(square_numbers()) f LIMIT 1) FROM fibers(square_numbers()) $q$),
  ('square_numbers','unrank(12) = 144 = S(12)','eq','144','off the floor',$q$
    SELECT (unrank(square_numbers(), 12)).value::text $q$),
  ('square_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(square_numbers())::text $q$),
  ('square_numbers','contains is rank-agnostic: 49 ∈, 50 ∉ (via <@)','eq','true|false','generated contains + operator (trunc(√n)² = n)',$q$
    SELECT (49::numeric <@ square_numbers())::text || '|' || (50::numeric <@ square_numbers())::text $q$);
