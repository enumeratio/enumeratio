-- requires: realizer, schroeder_numbers
-- little_schroder_numbers — the LITTLE Schröder / super-Catalan numbers s(n) (A001003): 1,1,3,11,45,197,903,…
-- as a first-class UNBOUNDED numeric collection, sibling of schroeder_numbers (the large Schröder numbers r(n),
-- A006318). No new recurrence needed: the classic identity r(n) = 2·s(n) for n ≥ 1 (r(0)=s(0)=1, the one place
-- the two families coincide) lets s(n) borrow schroeder_large_number's already-validated recurrence directly —
-- exact integer division since r(n) is always even for n ≥ 1.
CREATE FUNCTION little_schroder_number(n term_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN n = 0 THEN 1::numeric ELSE div(schroeder_large_number(n), 2) END $$;
CREATE TYPE little_schroder_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f little_schroder_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT little_schroder_number(r) FROM generate_series(0, element_limit - 1) r $$;
-- direct unrank (capability layer 3): the ord-th element via the r(n)/2 identity above, no iteration needed beyond it.
CREATE FUNCTION fiber_unrank(f little_schroder_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT little_schroder_number(rank::term_index) $fu$;
INSERT INTO base_collection VALUES ('little_schroder_numbers', 'numeric', true);   -- unbounded, ungraded
INSERT INTO base_monotonic_sequence VALUES ('little_schroder_numbers');   -- non-decreasing: synth a scanning contains
SELECT base_realize('little_schroder_numbers');

-- OEIS base_reference row (A001003) is NOT inserted here: base_reference lives behind references.sql, whose own
-- chain (references → constructions → requires-tag: collection) needs every collection loaded FIRST — so no
-- collection file can insert into it without a requires cycle. Every other collection's OEIS pointer is centralized
-- in oeis-refs.sql for the same reason (e.g. 'dissections' already carries A001003 there, per-fiber cardinality,
-- not as a sequence); this one wants the same treatment — see close-out for the exact row to add.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('little_schroder_numbers','first seven s(0..6) — A001003','eq','1,1,3,11,45,197,903','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(little_schroder_numbers(), 7) e $q$),
  ('little_schroder_numbers','unrank(4) = s(4) = 45','eq','45','off the floor',$q$
    SELECT (unrank(little_schroder_numbers(), 4)).value::text $q$),
  ('little_schroder_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(little_schroder_numbers())::text $q$),
  ('little_schroder_numbers','r(n) = 2·s(n) for n ≥ 1 ties back to the realized large-Schröder floor (n=1..6)','eq','all-match',
   'schroeder_numbers term n = 2 · little_schroder_numbers term n, n ≥ 1',$q$
    SELECT coalesce(string_agg('n='||n, ', '), 'all-match') FROM generate_series(1,6) n
    WHERE (unrank(schroeder_numbers(), n)).value <> 2 * (unrank(little_schroder_numbers(), n)).value $q$),
  ('little_schroder_numbers','contains is rank-agnostic: 45 ∈, 44 ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (45::numeric <@ little_schroder_numbers())::text || '|' || (44::numeric <@ little_schroder_numbers())::text $q$);
