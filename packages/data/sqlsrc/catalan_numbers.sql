-- requires: realizer, utilities
-- catalan_numbers — another UNGRADED / infinite collection (carrier numeric), like fibonacci/prime_numbers.
-- The floor = the n-th Catalan number C(n) = binomial(2n,n)/(n+1), built by the exact integer recurrence
-- C(n) = C(n-1)·2·(2n-1)/(n+1) using div() so no numeric rounding creeps in. Provides a rank-agnostic contains.

CREATE FUNCTION catalan_number(r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE c numeric := 1; i int; BEGIN
    IF r < 0 THEN RETURN NULL; END IF;
    FOR i IN 1..r LOOP c := div(c * 2 * (2*i - 1), i + 1); END LOOP;   -- exact: the product is always divisible by i+1
    RETURN c;
  END $$;
CREATE TYPE catalan_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f catalan_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT catalan_number(r) FROM generate_series(0, element_limit - 1) r $$;                       -- rank r (0-based) → C(r)
-- membership via the generic monotonic-scan contains synthesized from fiber_unrank (non-decreasing sequence)

CREATE FUNCTION fiber_symbol(f catalan_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'C' $$;   -- the Catalan family C (ungraded)

-- direct unrank (capability layer 3): the ord-th Catalan number IS C(ord) — O(1), no iterating.
CREATE FUNCTION fiber_unrank(f catalan_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan_number(rank::int) $$;
INSERT INTO base_collection VALUES ('catalan_numbers', 'numeric', true);                         -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('catalan_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('catalan_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalan_numbers','first terms via the realized floor','eq','1,1,2,5,14,42,132,429','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(catalan_numbers(), 8) e $q$),
  ('catalan_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(catalan_numbers()) f LIMIT 1) FROM fibers(catalan_numbers()) $q$),
  ('catalan_numbers','unrank(6) = 132 (the 7th Catalan number)','eq','132','rank 6 (0-based)',$q$
    SELECT (unrank(catalan_numbers(), 6)).value::text $q$),
  ('catalan_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(catalan_numbers())::text $q$),
  ('catalan_numbers','contains is rank-agnostic: 42 ∈, 100 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (42::numeric <@ catalan_numbers())::text || '|' || (100::numeric <@ catalan_numbers())::text $q$),
  ('catalan_numbers','set_notation: unrank(3) ↦ 5 ∈ C (constant family symbol)','eq','5 ∈ C','ungraded ⇒ no parameters in the symbol',$q$
    SELECT set_notation(unrank(catalan_numbers(), 3)) $q$);
