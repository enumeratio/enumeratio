-- requires: base_species
-- requires-tag: collection
-- paths half of the species registry (#283 phase 3 extraction, reconciled with #274): core base_species.sql defines
-- base_species_def (the shared species identities, incl. these exprs) + base_collection_species; this pack binds its
-- own path collections' READINGS. motzkin_paths/schroeder_paths are isotype readings of the Motzkin/Schröder OGF
-- fixed points (finite fibers), checked by base_species_check_unlabelled/ogf_solve. requires-tag: collection (scoped
-- to this pack per orderFiles) ensures motzkin_paths/schroeder_paths have loaded first.
INSERT INTO base_collection_species (collection, species, reading) VALUES
  ('motzkin_paths',   '1+X·Y+X^2·Y^2', 'isotype'),
  ('schroeder_paths', '1+X·Y+X·Y^2',   'isotype');
