-- requires: permutations, realizer, utilities
-- factorial_numbers (A000142) — ported from pg-enumeratio-core_old_backup/sqlsrc/counting-sequences.sql.
-- Old model: factorial_numbers_term(r) = r! via math_factorial, catalog_collection kind 'numeric', ascending order.
-- New model: the UNGRADED / infinite case (like fibonacci_numbers, gap 3). No grades ⇒ one empty-address fiber;
-- unbounded ⇒ cardinality = ∞. Carrier numeric. Provides a floor + a rank-agnostic contains engine.
-- Reuses the global factorial(n int) RETURNS numeric helper already defined in 10-permutations.sql.

CREATE TYPE factorial_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f factorial_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT factorial(r) FROM generate_series(0, element_limit-1) r $$;
-- membership: v is a factorial iff repeatedly dividing out 2,3,4,… bottoms out at exactly 1 (v<1 or non-integer ⇒ false).
CREATE FUNCTION contains_in_fiber(f factorial_numbers_fiber, v numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m numeric := v; k int := 2; BEGIN
    IF v < 1 OR v <> trunc(v) THEN RETURN false; END IF;
    WHILE m > 1 LOOP
      IF mod(m, k) <> 0 THEN RETURN false; END IF;
      m := div(m, k); k := k + 1;
    END LOOP;
    RETURN true;
  END $$;

-- direct unrank (capability layer 3): the ord-th factorial IS ord! — O(1), no iterating.
CREATE FUNCTION fiber_unrank(f factorial_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT factorial(rank::int) $$;
INSERT INTO base_collection VALUES ('factorial_numbers', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('factorial_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('factorial_numbers','first terms via the realized floor','eq','1,1,2,6,24,120,720','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(factorial_numbers(), 7) e $q$),
  ('factorial_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle) (gap 3)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(factorial_numbers()) f LIMIT 1) FROM fibers(factorial_numbers()) $q$),
  ('factorial_numbers','unrank(5) = 120','eq','120','off the floor',$q$
    SELECT (unrank(factorial_numbers(), 5)).value::text $q$),
  ('factorial_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(factorial_numbers())::text $q$),
  ('factorial_numbers','contains is rank-agnostic: 24 ∈, 5 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (24::numeric <@ factorial_numbers())::text || '|' || (5::numeric <@ factorial_numbers())::text $q$),
  ('factorial_numbers','structural invariant: term(r) = r × term(r-1) for r=1..6','eq','true','the defining recurrence',$q$
    SELECT bool_and((unrank(factorial_numbers(), r)).value = r * (unrank(factorial_numbers(), r-1)).value)
    FROM generate_series(1,6) r $q$);
