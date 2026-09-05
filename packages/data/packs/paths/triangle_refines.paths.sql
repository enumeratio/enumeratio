-- requires: triangle_refines, schroeder_triangle, schroeder_paths
-- paths half of sqlsrc/triangle_refines.sql's base_triangle_refines seed (#283 phase 3 extraction) — split out
-- because base_triangle_refines is a core-owned TABLE and this pack may only INSERT rows into it (§3.3 pack
-- contract), never edit core's own INSERT statement.

INSERT INTO base_triangle_refines (triangle, parent, stat_id) VALUES
  ('schroeder_triangle', 'schroeder_paths', 'flat_steps');   -- T(n,k), refining the large Schröder numbers
