-- requires: triangle_slices, k_part_partitions, bounded_part_partitions
-- partitions-plus half of sqlsrc/triangle_slices.sql's base_triangle seed (#283 phase 3 extraction) — split out
-- because base_triangle is a core-owned TABLE and this pack may only INSERT rows into it (§3.3 pack contract),
-- never edit core's own INSERT statement. k_part_partitions carries `sequence = 'partition_numbers'` — core's
-- row-sum differential (triangle_slices.sql, suite 'triangles') sweeps every base_triangle row with a sequence
-- set, so this row must exist wherever k_part_partitions itself does.

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('k_part_partitions',       'n', 'k', 'Partitions of n into k parts — p(n,k)', 'partition_numbers'),
  ('bounded_part_partitions', 'n', 'k', 'Partitions of n into parts ≤ k', NULL);
