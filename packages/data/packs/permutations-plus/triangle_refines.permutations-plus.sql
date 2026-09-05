-- requires: triangle_refines, triangle_slices.permutations-plus
-- requires-tag: collection
-- permutations-plus half of sqlsrc/triangle_refines.sql (#283 phase 3 extraction) — every row where BOTH the
-- triangle and the parent are permutations-plus collections; base_triangle_refines FKs both columns (triangle
-- REFERENCES base_triangle, parent REFERENCES base_collection), so a row here would FK-fail loading core alone,
-- and needs triangle_slices.permutations-plus.sql's base_triangle rows (k_descent_permutations,
-- k_cycle_permutations, surjections_onto_k) already inserted.

INSERT INTO base_triangle_refines (triangle, parent, stat_id) VALUES
  ('k_descent_permutations', 'permutations',    'descents'),             -- Eulerian ⟨n,k⟩
  ('k_descent_permutations', 'permutations',    'ascents'),              -- … equidistributed (reverse)
  ('k_descent_permutations', 'permutations',    'excedances'),           -- … equidistributed (Foata's fundamental transform)
  ('k_cycle_permutations',   'permutations',    'cycles'),               -- unsigned Stirling-1 c(n,k)
  ('k_cycle_permutations',   'permutations',    'left_to_right_maxima'), -- … equidistributed (Foata's first transform)
  ('surjections_onto_k',     'surjections',     'image_size'),           -- k!·S(n,k)
  -- issue #220 chunk 2 — the Mahonian triangle (permutations by inversions had no triangle: #216 piece 5):
  ('k_inversion_permutations', 'permutations',  'inversions');           -- Mahonian T(n,k), the q-factorial coefficients

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangle_refines','equidistribution as data: descents, ascents and excedances share the Eulerian triangle','eq','true','a floor — more equidistributed statistics may join',$q$
    SELECT ((SELECT array_agg(stat_id) FROM base_triangle_refines WHERE triangle = 'k_descent_permutations') @> ARRAY['descents','ascents','excedances'])::text $q$);
