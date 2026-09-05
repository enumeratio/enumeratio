-- requires: little_schroder_triangle, realizer, utilities
-- little_schroder_triangle statistics — little_schroder_triangle_path is a BESPOKE carrier (distinct from
-- schroeder_path / schroeder_triangle_path), so it carries no inherited stats. `hills` names the grading axis k
-- directly (a hill = a U-D adjacency whose U leaves height 0 — the file's own hill-counting definition), giving the
-- query view a column to GROUP BY on an ungraded little_schroder_triangle(n) row-set.

-- ── statistics (carrier: little_schroder_triangle_path(steps int[]) of {-1,0,1}) ───────────────────────
-- hills: a U-D adjacency whose U leaves height 0. Equals the k grade on every element of fiber [n,k].
CREATE FUNCTION little_schroder_hills(p little_schroder_triangle_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT s, lead(s) OVER (ORDER BY o) AS s2,
           sum(s) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS h_before
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)
  ) q WHERE s = 1 AND s2 = -1 AND coalesce(h_before, 0) = 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('little_schroder_triangle','hills','little_schroder_hills','Hills','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('little_schroder_triangle','hills equals the k grade on every element of fiber [4,2]','eq','true','the defining invariant — this IS what k counts',$q$
    SELECT bool_and(little_schroder_hills((e).value) = 2)::text FROM elements(little_schroder_triangle(4,2)) e $q$),
  ('little_schroder_triangle','the all-hill path at n=3 is UDUDUD, with 3 hills','eq','3','s(3,3)=1, no nesting possible',$q$
    SELECT little_schroder_hills((unrank(little_schroder_triangle(3,3),0)).value)::text $q$),
  ('little_schroder_triangle','the floor at [2,0] (UUDD, UFD) has 0 hills each','eq','0,0','a nested peak and a flat-wrapped peak both hide their peak above height 0',$q$
    SELECT string_agg(little_schroder_hills((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(little_schroder_triangle(2,0)) e $q$);
