-- requires: base_species, binary_words.stats
-- requires-tag: collection
-- (same reason as core's base_species.sql: this INSERTs a species row for a words-plus collection, so it must
-- load after every one of this pack's OWN collection files — the tag slurps them, scoped to this pack per
-- orderFiles.)
-- words-plus half of sqlsrc/base_species.sql (#283 phase 3, reconciled with #274) — core keeps base_species_def
-- (the shared species identities, incl. E∘E+) and its own readings; this pack binds its collection's READING.

INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('restricted_growth_strings', 'E∘E+', 'labelled', 'RGS encode set partitions');

-- relabel_invariant (#274 B6) for THIS pack's stat row: number_of_ones counts ones in a binary word, unchanged by
-- relabelling the underlying atoms. Core's base_species.sql marks its own four rows and cannot mark this one —
-- binary_words.stats.sql is words-plus-owned, so a core UPDATE would raise base_guard_pack (and at core-load time
-- the row does not exist). Same pack updating its own row is exactly what the guard permits.
UPDATE base_stat SET relabel_invariant = true WHERE (collection, stat_id) = ('binary_words','number_of_ones');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','relabel_invariant is set on this pack''s binary_words.number_of_ones stat','eq','true',
   'the pack marks the row it owns; core marks its own four (#283 phase 3 / #274 B6)',$q$
    SELECT relabel_invariant::text FROM base_stat WHERE collection = 'binary_words' AND stat_id = 'number_of_ones' $q$);
