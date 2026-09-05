-- requires: triangle_slices, surjections_onto_k, k_cycle_permutations, k_descent_permutations, fubini_numbers
-- permutations-plus half of sqlsrc/triangle_slices.sql (#283 phase 3 extraction) — base_triangle has no FK on
-- `collection` (loads independent of collection load order), but the row-specific examples below call
-- surjections_onto_k()/k_cycle_permutations()/k_descent_permutations() directly, so they must load after this
-- pack's own collection files.

INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('surjections_onto_k',     'n', 'k', 'Surjections [n] ↠ [k] — k!·S(n,k)', 'fubini_numbers'),
  ('k_cycle_permutations',   'n', 'k', 'Unsigned Stirling numbers of the 1st kind — cycle triangle c(n,k)', 'factorial_numbers'),
  ('k_descent_permutations', 'n', 'k', 'Eulerian numbers — descent triangle ⟨n,k⟩', 'factorial_numbers');

-- cycle triangle (unsigned Stirling-1, A132393) and Eulerian triangle (A008292): both refine permutations(n) = n!
-- by a per-permutation statistic (cycle count / descent count) — same triangle-of-a-realized-collection pattern
-- as Pascal/Stirling-2/Narayana/surjections (core), just riding the existing k_cycle_permutations /
-- k_descent_permutations engines rather than a fresh carrier (issue #77).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('triangles','surjection-triangle row-sum is the Fubini sequence (Σ_k k!·S(n,k), n=0..6)','eq','1,1,3,13,75,541,4683',
   'triangle_rowsum(surjections_onto_k, n) = a(n), the newly-registered fubini_numbers sequence',$q$
    SELECT string_agg(triangle_rowsum('surjections_onto_k', n)::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('triangles','cycle triangle (unsigned Stirling-1) row n=4 = 0,6,11,6,1 (k_cycle_permutations)','eq','0,6,11,6,1',
   'c(4,k) for k=0..4; c(4,0)=0 is the trivial no-cycle column (k axis is declared 0..n)',$q$
    SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('k_cycle_permutations', 4) $q$),
  ('triangles','Eulerian triangle row n=4 = 1,11,11,1 (k_descent_permutations)','eq','1,11,11,1','⟨4,k⟩ for k=0..3 (A008292)',$q$
    SELECT string_agg(value::text, ',' ORDER BY col_index) FROM triangle_row('k_descent_permutations', 4) $q$),
  ('triangles','cycle-triangle row-sum is n! (Σ_k c(n,k), n=0..6)','eq','1,1,2,6,24,120,720',
   'triangle_rowsum(k_cycle_permutations, n) = n! = factorial_numbers term n',$q$
    SELECT string_agg(triangle_rowsum('k_cycle_permutations', n)::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('triangles','Eulerian-triangle row-sum is n! (Σ_k ⟨n,k⟩, n=0..6)','eq','1,1,2,6,24,120,720',
   'triangle_rowsum(k_descent_permutations, n) = n! = factorial_numbers term n',$q$
    SELECT string_agg(triangle_rowsum('k_descent_permutations', n)::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$);

-- fubini_numbers' own floor (set_compositions' binomial-convolution recurrence, core) vs this pack's surjection
-- triangle row-sum: two independently-computed sequences agreeing, moved out of core's fubini_numbers.sql because
-- surjections_onto_k is a permutations-plus collection (same pattern as motzkin_numbers dropping its
-- motzkin_paths cross-check to `paths`).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fubini_numbers','a(n) = |surjections_onto_k row-sum|: n=0..6 agree','eq','true','the floor value IS the surjection-triangle row-sum',$q$
    SELECT bool_and((unrank(fubini_numbers(), n)).value = triangle_rowsum('surjections_onto_k', n)::numeric)::text FROM generate_series(0,6) n $q$);
