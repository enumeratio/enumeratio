-- requires: triangle_slices, compositions_into_k_parts, weak_compositions_into_k_parts
-- compositions-plus half of sqlsrc/triangle_slices.sql's base_triangle seed (#283 phase 3 extraction) — split out
-- because base_triangle has no FK on `collection` (so the seed loads independent of collection load order), but a
-- row naming a pack-owned collection under core alone is still a runtime-only trap the moved files must avoid: an
-- example iterating base_triangle and calling the collection's constructor would fail. Neither row names a
-- `sequence` (compositions' row-sum, 2^{n−1}/2^{n+k−1}, isn't its own realized collection), so neither
-- participates in sqlsrc/triangle_slices.sql's row-sum sweep example.

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('compositions_into_k_parts',      'n', 'k', 'Compositions of n into k parts — C(n−1,k−1)', NULL),
  ('weak_compositions_into_k_parts', 'n', 'k', 'Weak compositions of n into k parts — C(n+k−1,k−1)', NULL);
