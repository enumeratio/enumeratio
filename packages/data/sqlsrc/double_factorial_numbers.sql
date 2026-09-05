-- requires: realizer, utilities
-- double_factorial_numbers (A001147) — the odd double factorial (2n−1)!! = 1·3·5···(2n−1):
-- 1,1,3,15,105,945,10395,135135,… UNGRADED, UNBOUNDED numeric sequence (same shape as factorial_numbers).
-- Counts perfect matchings of K₂ₙ (pairings of 2n points) and the Gaussian moments E[X^{2n}]. Uses
-- double_factorial_odd from utilities; a(n) = (2n−1)·a(n−1), a(0)=1.

CREATE TYPE double_factorial_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f double_factorial_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT double_factorial_odd(r) FROM generate_series(0, element_limit-1) r $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f double_factorial_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT double_factorial_odd(rank::int) $fu$;
INSERT INTO base_collection VALUES ('double_factorial_numbers', 'numeric', true);   -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('double_factorial_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('double_factorial_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('double_factorial_numbers','first eight — A001147','eq','1,1,3,15,105,945,10395,135135','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(double_factorial_numbers(), 8) e $q$),
  ('double_factorial_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(double_factorial_numbers()) f LIMIT 1) FROM fibers(double_factorial_numbers()) $q$),
  ('double_factorial_numbers','unrank(5) = (2·5−1)!! = 945','eq','945','off the floor',$q$
    SELECT (unrank(double_factorial_numbers(), 5)).value::text $q$),
  ('double_factorial_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(double_factorial_numbers())::text $q$),
  ('double_factorial_numbers','recurrence: a(n) = (2n−1)·a(n−1) for n=1..7','eq','true','the defining recurrence',$q$
    SELECT bool_and((unrank(double_factorial_numbers(), n)).value = (2*n-1) * (unrank(double_factorial_numbers(), n-1)).value)
    FROM generate_series(1,7) n $q$);
