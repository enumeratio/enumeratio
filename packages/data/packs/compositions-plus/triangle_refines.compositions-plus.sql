-- requires: triangle_refines, triangle_slices.compositions-plus
-- compositions-plus half of sqlsrc/triangle_refines.sql — the compositions_into_k_parts row, split out because
-- base_triangle_refines FKs both columns (triangle REFERENCES base_triangle, parent REFERENCES base_collection),
-- so a row here would FK-fail loading core alone (the parent, integer_compositions, is core; the triangle,
-- compositions_into_k_parts, is this pack's — needs triangle_slices.compositions-plus.sql's base_triangle row
-- already inserted).

INSERT INTO base_triangle_refines (triangle, parent, stat_id) VALUES
  ('compositions_into_k_parts', 'integer_compositions', 'parts_count');  -- C(n-1,k-1), refining 2^(n-1)
