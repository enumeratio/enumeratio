-- requires: triangle_refines, k_part_partitions, triangle_slices.partitions-plus
-- partitions-plus half of sqlsrc/triangle_refines.sql's base_triangle_refines seed (#283 phase 3 extraction) —
-- split out because base_triangle_refines is a core-owned TABLE and this pack may only INSERT rows into it
-- (§3.3 pack contract), never edit core's own INSERT statement.

INSERT INTO base_triangle_refines (triangle, parent, stat_id) VALUES
  ('k_part_partitions', 'integer_partitions', 'length');   -- p(n,k), refining p(n)
