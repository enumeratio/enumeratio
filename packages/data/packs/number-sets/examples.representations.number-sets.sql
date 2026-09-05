-- requires: representations, stern_brocot_paths
-- number-sets half of sqlsrc/representations.sql's repr-scope-leak-fence example (#283 phase 3 extraction) —
-- stern_brocot_paths is a number-sets collection, split out the same way polytopes did (#283 phase 2.2, see
-- packs/polytopes/examples.representations.polytopes.sql).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','the turns/rational reprs still resolve on their OWN collections (own rows ignore scope)','eq','2','stern_brocot_paths keeps turns + rational',$q$
    SELECT count(*)::text FROM base_repr_resolved WHERE collection = 'stern_brocot_paths' AND repr IN ('turns','rational') $q$);
