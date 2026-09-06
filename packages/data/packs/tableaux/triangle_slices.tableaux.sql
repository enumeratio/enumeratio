-- requires: triangle_slices
-- tableaux half of sqlsrc/triangle_slices.sql (#283 phase 3 lane 2 extraction) — base_triangle has no FK on
-- `collection` (loads independent of collection load order), and no example calls gelfand_tsetlin() directly here,
-- but the row is this pack's own collection and belongs with it — core owns the table, packs own their rows (§4).

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('gelfand_tsetlin', 'n', 'k', 'Gelfand–Tsetlin patterns by size and entry bound', NULL);
