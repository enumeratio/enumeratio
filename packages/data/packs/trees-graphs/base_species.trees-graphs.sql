-- requires: base_species
-- requires-tag: collection
-- trees-graphs half of sqlsrc/base_species.sql (#283 phase 3 extraction) — core keeps the table + rows for core
-- collections; this pack carries the rows for its own collections. plane_trees/ordered_trees are unlabelled OGF
-- fixed points (same Catalan shape as dyck_paths/binary_trees, which stay core); labeled_forests/labeled_trees are
-- labelled implicit species (rooted forests / unrooted Cayley trees via dissymmetry).
-- requires-tag: collection (scoped to this pack's own files by orderFiles) ensures these collections have loaded.

INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('plane_trees',   'X+Y^2',        'P=x+P^2',      'plane trees by NODES; C_{n-1} (shifted Catalan)', true),
  ('ordered_trees', '1+X·Y^2',      'C=1+xC^2',     'ordered trees by edges; Catalan',                 true);

INSERT INTO base_species (collection, expr, egf, note, implicit) VALUES
  ('labeled_forests', 'E∘(X·Y)', 'F=e^{xF}', 'rooted labelled forests; (n+1)ⁿ⁻¹ = 1,1,3,16,125,…', true);

INSERT INTO base_species (collection, expr, egf, note, implicit, solve_for) VALUES
  ('labeled_trees', '1+Y-Y·Y/2', '1+T-\tfrac{T^2}{2}', 'unrooted (Cayley) trees; nⁿ⁻² by dissymmetry T−T²/2, +1 for the collection''s empty-tree convention (n≤2 ↦ 1)', true, 'X·(E∘Y)');
