-- requires: base_species
-- requires-tag: collection
-- trees-graphs half of the species registry (#283 phase 3 extraction, reconciled with #274): core base_species.sql
-- defines base_species_def (the shared identities, incl. every expr used here) + base_collection_species; this pack
-- binds its own tree collections' READINGS. plane_trees/ordered_trees are isotype readings of Catalan-shape OGF fixed
-- points; labeled_forests/labeled_trees are labelled implicit species; rooted_unlabeled_trees is the isotype twin of
-- the rooted-tree fixpoint X·(E∘Y) (A000081, certified by the #274 B4 kernel). requires-tag: collection ensures
-- these collections have loaded first.
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('ordered_trees',          '1+X·Y^2', 'isotype', 'ordered trees by edges; Catalan'),
  ('plane_trees',            'X+Y^2',   'isotype', 'plane trees by NODES; C_{n-1} (shifted Catalan)'),
  ('rooted_unlabeled_trees', 'X·(E∘Y)', 'isotype', 'the isotype fixpoint for rooted unlabeled trees; A000081');

-- labelled fixpoints: rooted forests (E∘(X·Y)); unrooted trees (two-stage — Y solves X·(E∘Y), then the dissymmetry
-- identity A + T² = T + E₂∘T is evaluated over it — labelled = Cayley, isotype = Otter, one species two readings).
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('labeled_forests', 'E∘(X·Y)', 'labelled', 'rooted labelled forests; (n+1)ⁿ⁻¹ = 1,1,3,16,125,…');
INSERT INTO base_collection_species (collection, species, reading, bindings, note) VALUES
  ('labeled_trees',        '1+Y+E_2∘Y-Y·Y', 'labelled', '{"solve_for":"X·(E∘Y)"}', 'unrooted (Cayley) trees; nⁿ⁻² by dissymmetry, +1 for the collection''s empty-tree convention (n≤2 ↦ 1)'),
  ('unlabeled_free_trees', 'Y+E_2∘Y-Y·Y',   'isotype',  '{"solve_for":"X·(E∘Y)"}', 'the isotype twin of labeled_trees: Otter''s formula off the cycle index; A000055 (no n=0 tree, so no +1)');
