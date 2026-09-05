-- requires: realizer
-- schroeder_numbers — the LARGE Schröder numbers S(n) as a first-class UNBOUNDED numeric collection (A006318):
-- 1,2,6,22,90,394,1806,… Sibling of schroeder_paths. New helper via the recurrence (n+1)S(n) = 3(2n-1)S(n-1) -
-- (n-2)S(n-2), S(0)=1, S(1)=2 (exact integer division). Ported from old-backup more-sequences-and-primes.sql.
CREATE FUNCTION schroeder_large_number(n term_index) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 1; b numeric := 2; t numeric; i int; BEGIN   -- a=S(0), b=S(1)
    IF n < 0 THEN RETURN 0; END IF;
    IF n = 0 THEN RETURN 1; END IF;
    FOR i IN 2..n LOOP
      t := div((6*i - 3) * b - (i - 2) * a, (i + 1)::numeric);       -- (i+1)S_i = 3(2i-1)S_{i-1} - (i-2)S_{i-2}
      a := b; b := t;
    END LOOP;
    RETURN b;
  END $$;
CREATE TYPE schroeder_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f schroeder_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT schroeder_large_number(r) FROM generate_series(0, element_limit - 1) r $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f schroeder_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT schroeder_large_number(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('schroeder_numbers', 'numeric', true);
INSERT INTO base_monotonic_sequence VALUES ('schroeder_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('schroeder_numbers');
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('schroeder_numbers','first seven S(0..6) — A006318','eq','1,2,6,22,90,394,1806','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(schroeder_numbers(), 7) e $q$),
  ('schroeder_numbers','unrank(4) = S(4) = 90','eq','90','off the floor',$q$
    SELECT (unrank(schroeder_numbers(), 4)).value::text $q$),
  ('schroeder_numbers','cardinality = infinity','eq','Infinity','unbounded sequence',$q$
    SELECT cardinality(schroeder_numbers())::text $q$);
