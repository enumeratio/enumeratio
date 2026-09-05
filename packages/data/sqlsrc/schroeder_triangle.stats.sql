-- requires: schroeder_triangle, realizer, utilities
-- schroeder_triangle statistics — schroeder_triangle_path is a BESPOKE carrier (distinct from schroeder_path), so it
-- carries none of schroeder_paths.stats.sql's functions. `flat_steps` names the grading axis k directly, giving the
-- query view a column to GROUP BY on an ungraded schroeder_triangle(n) row-set.

-- ── statistics (carrier: schroeder_triangle_path(steps int[]) of {-1,0,1}) ─────────────────────────────
-- flat_steps: the number of flat (F, 0-coded) steps. Equals the k grade on every element of fiber [n,k].
CREATE FUNCTION schroeder_triangle_flat_steps(p schroeder_triangle_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).steps) s WHERE s = 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('schroeder_triangle','flat_steps','schroeder_triangle_flat_steps','Flat steps','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('schroeder_triangle','flat_steps equals the k grade on every element of fiber [3,2]','eq','true','the defining invariant — this IS what k counts',$q$
    SELECT bool_and(schroeder_triangle_flat_steps((e).value) = 2)::text FROM elements(schroeder_triangle(3,2)) e $q$),
  ('schroeder_triangle','the all-flat path at n=2 (FF) has 2 flats','eq','2','T(2,2)=1, the single all-flat path',$q$
    SELECT schroeder_triangle_flat_steps((unrank(schroeder_triangle(2,2),0)).value)::text $q$),
  ('schroeder_triangle','column k=0 (pure Dyck paths) has 0 flats, n=0..3','eq','true','T(n,0) paths carry no F steps',$q$
    SELECT bool_and(schroeder_triangle_flat_steps((e).value) = 0)::text
      FROM generate_series(0,3) n, LATERAL elements(schroeder_triangle(n,0)) e $q$);
