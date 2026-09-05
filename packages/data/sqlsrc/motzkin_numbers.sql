-- requires: motzkin_paths, realizer
-- motzkin_numbers — the Motzkin-number sequence M(n) as a first-class UNBOUNDED numeric collection (A001006):
-- 1,1,2,4,9,21,51,127,323,… Sibling of motzkin_paths (whose fiber cardinalities these are). Reuses the existing
-- motzkin(n) helper. Ported from old-backup linear-and-figurate-sequences.sql. No closed-form inverse ⇒ contains scans the monotonic floor until ≥ v.
CREATE TYPE motzkin_numbers_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f motzkin_numbers_fiber, element_limit int) RETURNS SETOF numeric LANGUAGE sql STABLE AS $$
  SELECT motzkin(r) FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION contains_in_fiber(f motzkin_numbers_fiber, v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- scan the monotonic floor until ≥ v
  WITH RECURSIVE t(k, val) AS (SELECT 0, motzkin(0) UNION ALL SELECT k+1, motzkin(k+1) FROM t WHERE val < v)
  SELECT EXISTS (SELECT 1 FROM t WHERE val = v) $$;
-- direct unrank (capability layer 3): the ord-th element via a closed form / combinatorial unrank.
CREATE FUNCTION fiber_unrank(f motzkin_numbers_fiber, rank rank_index) RETURNS numeric LANGUAGE sql IMMUTABLE AS $fu$ SELECT motzkin(rank::int) $fu$;
INSERT INTO base_collection VALUES ('motzkin_numbers', 'numeric', true);
SELECT base_realize('motzkin_numbers');
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('motzkin_numbers','first nine M(0..8) — A001006','eq','1,1,2,4,9,21,51,127,323','the realized floor',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(motzkin_numbers(), 9) e $q$),
  ('motzkin_numbers','unrank(6) = M(6) = 51','eq','51','off the floor',$q$
    SELECT (unrank(motzkin_numbers(), 6)).value::text $q$),
  ('motzkin_numbers','cardinality = infinity','eq','Infinity','unbounded sequence',$q$
    SELECT cardinality(motzkin_numbers())::text $q$),
  ('motzkin_numbers','contains via <@: 51 ∈ (M(6)), 50 ∉','eq','true|false','floor-scan membership',$q$
    SELECT (51::numeric <@ motzkin_numbers())::text || '|' || (50::numeric <@ motzkin_numbers())::text $q$);
