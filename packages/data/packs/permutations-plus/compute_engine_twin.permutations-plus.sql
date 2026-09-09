-- requires: symmetric_group
-- symmetric_group's base_compute_engine_twin row — split out of sqlsrc/compute_engine_twin.sql (core) because
-- symmetric_group is a permutations-plus PACK collection: core loads before any pack, so a core-file INSERT
-- referencing it would violate the base_compute_engine_twin FK before the collection is realized. The `pack`
-- column defaults from the `enumeratio.pack` GUC set while this pack builds, same as every other pack-tagged row.
INSERT INTO base_compute_engine_twin (collection, head, arity) VALUES
  ('symmetric_group', 'SymmetricGroup', 1);
