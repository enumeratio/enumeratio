-- requires: base_species
-- requires-tag: collection
-- paths half of sqlsrc/base_species.sql (#283 phase 3 extraction) — core keeps the table + rows for core
-- collections (motzkin_numbers/schroeder_numbers keep their own OGF rows, unlabelled unbounded number-sequence
-- siblings); this pack carries the rows for its own collections, same unlabelled OGF-fixed-point shape.
-- requires-tag: collection (scoped to this pack's own files by orderFiles) ensures motzkin_paths/schroeder_paths
-- have already loaded.

INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('motzkin_paths',   '1+X·Y+X^2·Y^2','M=1+xM+x^2M^2',    'Motzkin paths of length n',      true),
  ('schroeder_paths', '1+X·Y+X·Y^2',  'S=1+xS+xS^2',      'large Schröder paths of size n', true);
