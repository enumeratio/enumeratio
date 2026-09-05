-- requires: realizer
-- fibonacci_numbers — the UNGRADED / infinite case, now REALIZED (gap 3). No grades ⇒ one empty-address fiber;
-- unbounded ⇒ cardinality = ∞. Carrier numeric. Provides a floor + a rank-agnostic contains engine.

CREATE FUNCTION fibonacci_term(r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 0; b numeric := 1; t numeric; i int; BEGIN
    IF r = 0 THEN RETURN 0; END IF;
    FOR i IN 2..r LOOP t := a+b; a := b; b := t; END LOOP; RETURN b;
  END $$;
CREATE FUNCTION is_perfect_square(n numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT n >= 0 AND trunc(sqrt(n))^2 = n $$;

CREATE TYPE fibonacci_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f fibonacci_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT fibonacci_term(r) FROM generate_series(0, element_limit-1) r $$;
CREATE FUNCTION contains_in_fiber(f fibonacci_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT is_perfect_square(5*v*v + 4) OR is_perfect_square(5*v*v - 4) $$;   -- a Fibonacci iff 5n²±4 is square

INSERT INTO base_collection VALUES ('fibonacci_numbers', 'numeric', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f fibonacci_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Fib' $$;   -- corpus symbol
SELECT base_realize('fibonacci_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fibonacci_numbers','first terms via the realized floor','eq','0,1,1,2,3,5,8,13,21,34','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(fibonacci_numbers(), 10) e $q$),
  ('fibonacci_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle) (gap 3)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(fibonacci_numbers()) f LIMIT 1) FROM fibers(fibonacci_numbers()) $q$),
  ('fibonacci_numbers','unrank(10) = 55','eq','55','off the floor',$q$
    SELECT (unrank(fibonacci_numbers(), 10)).value::text $q$),
  ('fibonacci_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(fibonacci_numbers())::text $q$),
  ('fibonacci_numbers','contains is rank-agnostic: 8 ∈, 4 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (8::numeric <@ fibonacci_numbers())::text || '|' || (4::numeric <@ fibonacci_numbers())::text $q$),
  ('fibonacci_numbers','the recurrence F(r) = F(r-1) + F(r-2) holds off the floor for r=2..30','eq','true','a cross-check of unrank against its own defining recurrence, not just the closed-form loop that computes it',$q$
    SELECT bool_and((unrank(fibonacci_numbers(), r)).value = (unrank(fibonacci_numbers(), r-1)).value + (unrank(fibonacci_numbers(), r-2)).value)
    FROM generate_series(2,30) r $q$);
