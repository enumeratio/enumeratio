-- requires: realizer
-- lucas_numbers — the UNGRADED / infinite case (a companion to fibonacci). L(0)=2, L(1)=1, L(n)=L(n-1)+L(n-2):
-- 2,1,3,4,7,11,18,29,47,… Same recurrence as fibonacci, different seeds. No grades ⇒ one empty-address fiber;
-- unbounded ⇒ cardinality = ∞. Carrier numeric. Provides a floor + a rank-agnostic contains engine.

CREATE FUNCTION lucas_term(r term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 2; b numeric := 1; t numeric; i int; BEGIN   -- seeds L(0)=2, L(1)=1
    IF r = 0 THEN RETURN 2; END IF;
    FOR i IN 2..r LOOP t := a+b; a := b; b := t; END LOOP; RETURN b;
  END $$;
CREATE TYPE lucas_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f lucas_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT lucas_term(r) FROM generate_series(0, element_limit-1) r $$;
-- membership: the seeds L(0)=2, L(1)=1 break monotonicity, so test them by hand then scan from L(2)=3 upward.
CREATE FUNCTION contains_in_fiber(f lucas_numbers_fiber, v numeric) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 3; b numeric := 4; t numeric; BEGIN         -- scan from L(2)=3 upward (monotone past index 1)
    IF v = 1 OR v = 2 THEN RETURN true; END IF;                    -- L(1)=1, L(0)=2 handled by hand
    WHILE a <= v LOOP IF a = v THEN RETURN true; END IF; t := a+b; a := b; b := t; END LOOP;
    RETURN false;
  END $$;

-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f lucas_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT lucas_term(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('lucas_numbers', 'numeric', true);   -- unbounded, ungraded
SELECT base_realize('lucas_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lucas_numbers','first terms via the realized floor','eq','2,1,3,4,7,11,18,29,47','elements over the one infinite fiber',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(lucas_numbers(), 9) e $q$),
  ('lucas_numbers','ungraded ⇒ one fiber with empty address','eq','1|{}','fibers(handle)',$q$
    SELECT count(*)::text || '|' || (SELECT fiber_address(f)::text FROM fibers(lucas_numbers()) f LIMIT 1) FROM fibers(lucas_numbers()) $q$),
  ('lucas_numbers','unrank(8) = 47','eq','47','off the floor',$q$
    SELECT (unrank(lucas_numbers(), 8)).value::text $q$),
  ('lucas_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(lucas_numbers())::text $q$),
  ('lucas_numbers','contains is rank-agnostic: 7 ∈, 6 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (7::numeric <@ lucas_numbers())::text || '|' || (6::numeric <@ lucas_numbers())::text $q$);
