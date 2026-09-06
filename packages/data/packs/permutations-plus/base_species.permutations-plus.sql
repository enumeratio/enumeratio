-- requires: base_species
-- requires-tag: collection
-- permutations-plus half of the species registry (#283 phase 3 extraction, reconciled with #274): core
-- base_species.sql defines base_species_def (the shared identities, incl. every expr used here) + base_collection_species;
-- this pack binds its own collections' READINGS. Same reading shapes as core (labelled / graded-nat / labelled
-- two-stage-fixpoint via bindings.solve_for). requires-tag: collection ensures this pack's collections have loaded.
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('lehmer_codes',         'E∘C',       'labelled', 'order-iso sibling of permutations'),
  ('k_cycle_permutations', 'E∘C',       'labelled', 'permutations, grouped by cycle count'),
  ('subexcedant_seqs',     'E∘C',       'labelled', 'in bijection with permutations'),
  ('signed_permutations',  'E∘C∘(X+X)', 'labelled', 'hyperoctahedral B_n = 2ⁿ·n!'),
  ('surjections',          'L∘E+',      'labelled', 'onto a variable target = ordered set partitions'),
  ('arrangements',         'E·L',       'labelled', 'sequences of distinct elements; A000522'),
  ('cyclic_permutations',  'C',         'labelled', 'a single cycle; (n−1)!');

-- graded (a secondary-grade parameter k): (E+)^k = k-fold product of the nonempty-set atom.
INSERT INTO base_collection_species (collection, species, reading, bindings) VALUES
  ('surjections_onto_k', '(E+)^k', 'labelled', '{"k":{"kind":"nat"}}');

-- labelled fixpoints: parking functions (E∘(X·Y)); endofunctions (two-stage — Y solves X·(E∘Y), then E∘(C∘Y) over it).
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('parking_functions', 'E∘(X·Y)', 'labelled', 'parking functions of length n; (n+1)ⁿ⁻¹');
INSERT INTO base_collection_species (collection, species, reading, bindings, note) VALUES
  ('endofunctions', 'E∘(C∘Y)', 'labelled', '{"solve_for":"X·(E∘Y)"}', 'functions [n]→[n]; nⁿ = set of cycles of rooted trees');
