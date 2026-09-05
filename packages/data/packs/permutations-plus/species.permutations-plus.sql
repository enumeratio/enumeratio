-- requires: species, cyclic_permutations
-- permutations-plus half of sqlsrc/species.sql (#283 phase 3 extraction) — cyclic_permutations INHERITS the
-- permutation-carrier species reprs (registered in core's species.sql) via base_repr_resolved, so no explicit
-- base_repr row is needed here; only the examples that call cyclic_permutations() directly move.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','cyclic_permutations INHERITS at least the species reprs via the shared permutation carrier (a floor — more may be added)','eq','true','base_repr_resolved carries carrier reprs to the restriction',$q$
    SELECT (array_agg(repr) @> ARRAY['cycle_species','species'])::text FROM base_repr_resolved WHERE collection = 'cyclic_permutations' AND repr LIKE '%species%' $q$),
  ('species','on a cyclic permutation the E∘C reading collapses to the lone atom C: cyclic_permutations(3) rank 0 = 231 → C[{1,2,3}]','eq','C[{1,2,3}]','a single n-cycle is atomic',$q$
    SELECT permutation_cycle_species_notation((unrank(cyclic_permutations(3), 0)).value) $q$);
