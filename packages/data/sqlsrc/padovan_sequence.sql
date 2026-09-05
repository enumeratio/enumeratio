-- requires: realizer
-- padovan_sequence — the Padovan numbers: P(0)=P(1)=P(2)=1, P(n)=P(n-2)+P(n-3) for n>=3, giving
-- 1,1,1,2,2,3,4,5,7,9,12,16,21,28,... UNGRADED, UNBOUNDED numeric sequence (same shape as fibonacci_numbers
-- in 20-fibonacci.sql). No grades ⇒ one empty-address fiber; unbounded ⇒ cardinality = ∞.

CREATE FUNCTION padovan_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 1; b numeric := 1; c numeric := 1; t numeric; i int; BEGIN
    IF r <= 2 THEN RETURN 1; END IF;
    FOR i IN 3..r LOOP t := a+b; a := b; b := c; c := t; END LOOP; RETURN c;
  END $$;

CREATE TYPE padovan_sequence_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f padovan_sequence_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT padovan_term(r) FROM generate_series(0, element_limit-1) r $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f padovan_sequence_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT padovan_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('padovan_sequence', 'numeric', true);   -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('padovan_sequence');   -- non-decreasing: synth a scanning contains
SELECT base_realize('padovan_sequence');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('padovan_sequence','first terms via the realized floor','eq','1,1,1,2,2,3,4,5,7,9,12,16','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(padovan_sequence(), 12) e $q$),
  ('padovan_sequence','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle) (gap 3)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(padovan_sequence()) f LIMIT 1) FROM fibers(padovan_sequence()) $q$),
  ('padovan_sequence','unrank(10) = 12','eq','12','off the floor',$q$
    SELECT (unrank(padovan_sequence(), 10)).value::text $q$),
  ('padovan_sequence','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(padovan_sequence())::text $q$),
  ('padovan_sequence','recurrence holds: P(n) = P(n-2)+P(n-3) for n=3..11','eq','true','structural invariant over the first terms',$q$
    SELECT bool_and(v.value = p2.value + p3.value)
    FROM elements(padovan_sequence(), 12) v
    JOIN elements(padovan_sequence(), 12) p2 ON lower(p2.rank) = lower(v.rank) - 2
    JOIN elements(padovan_sequence(), 12) p3 ON lower(p3.rank) = lower(v.rank) - 3
    WHERE lower(v.rank) >= 3 $q$);
