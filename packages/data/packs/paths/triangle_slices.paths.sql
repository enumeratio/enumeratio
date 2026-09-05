-- requires: triangle_slices
-- paths half of sqlsrc/triangle_slices.sql (#283 phase 3 extraction) — base_triangle has no FK on `collection`
-- (loads independent of collection load order), and no example calls k_dyck_paths() directly here (unlike the
-- permutations-plus/surjections_onto_k case), but the row is this pack's own collection and belongs with it —
-- core owns the table, packs own their rows (§4).

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('k_dyck_paths', 'n', 'k', 'k-Dyck paths by semilength and order', NULL);
