-- requires: base_species
-- requires-tag: collection
-- (same reason as core's base_species.sql: this INSERTs species rows for permutations-plus collections, so it
-- must load after every one of this pack's OWN collection files — the tag slurps them, scoped to this pack per
-- orderFiles.)
-- permutations-plus half of sqlsrc/base_species.sql (#283 phase 3 extraction) — core keeps the table + rows for
-- core collections; this pack carries its own rows, split by the same INSERT-variant shape as core's file
-- (plain / graded / implicit / implicit+solve_for).

INSERT INTO base_species (collection, expr, egf, note) VALUES
  ('lehmer_codes',              'E∘C',        '\frac{1}{1-x}',                 'order-iso sibling of permutations'),
  ('k_cycle_permutations',      'E∘C',        '\frac{1}{1-x}',                 'permutations, grouped by cycle count'),
  ('subexcedant_seqs',          'E∘C',        '\frac{1}{1-x}',                 'in bijection with permutations'),
  ('signed_permutations',       'E∘C∘(X+X)',  '\frac{1}{1-2x}',                'hyperoctahedral B_n = 2ⁿ·n!'),
  ('surjections',               'L∘E+',       '\frac{1}{2-e^x}',               'onto a variable target = ordered set partitions'),
  ('arrangements',              'E·L',        '\frac{e^x}{1-x}',               'sequences of distinct elements; Σ n!/k! = A000522'),
  ('cyclic_permutations',       'C',          '-\ln(1-x)',                     'a single cycle; (n−1)!');

-- graded (a secondary-grade parameter k): E_k = sets of size exactly k, ^k = k-fold product. Checked per k over n.
INSERT INTO base_species (collection, expr, egf, note, graded) VALUES
  ('surjections_onto_k', '(E+)^k', '(e^x-1)^k', 'surjections [n]→[k]; k!·S(n,k)', true);

-- LABELLED implicit (EGF fixed point Y = F(X,Y), solved by species_solve): parking functions.
INSERT INTO base_species (collection, expr, egf, note, implicit) VALUES
  ('parking_functions', 'E∘(X·Y)', 'F=e^{xF}', 'parking functions of length n; (n+1)ⁿ⁻¹', true);
-- two-stage: Y = the rooted-tree function (solve_for), then endofunctions = E∘(C∘Y) — a set of cycles of rooted trees.
INSERT INTO base_species (collection, expr, egf, note, implicit, solve_for) VALUES
  ('endofunctions', 'E∘(C∘Y)', 'e^{-\ln(1-T)}', 'functions [n]→[n]; nⁿ = set of cycles of rooted trees', true, 'X·(E∘Y)');
