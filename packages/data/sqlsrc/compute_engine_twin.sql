-- requires-tag: collection
-- requires: realizer
-- base_compute_engine_twin — the catalog collections that carry a certified @enumeratio/compute-engine twin: the
-- library collection HEAD (PascalCase) that enumerates the same set, and that head's construction ARITY. This is the
-- single source of truth for the collection↔library correspondence that the pure-CE notebook enumerator
-- (packages/client) and the reference generator read — it replaces the client-side COLL_HEADS map. A pack that ports
-- a new collection to compute-engine adds its own row here (pack column, like every registry). The library's O(1)
-- 1-based At / Rank / Length over the head IS the enumerator.
CREATE TABLE base_compute_engine_twin (
  collection text PRIMARY KEY REFERENCES base_collection,
  head       text NOT NULL,   -- the @enumeratio/compute-engine collection head (PascalCase)
  arity      int  NOT NULL,   -- number of construction parameters the head takes
  pack       text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);

-- The certified core twins. Every row here shares its name with the head (PascalCase of the catalog id) — as
-- of #406, `permutations` no longer needs the old SymmetricGroup-alias workaround: the library head is now
-- literally `Permutations`. The catalog's DISTINCT `symmetric_group` collection (#411 — same n! underlying set,
-- cycle notation, Coxeter-length order) gets its own twin, `SymmetricGroup`, matching that library head — but
-- symmetric_group lives in the permutations-plus PACK (loads after core), so its twin row can't sit here (an FK
-- to a not-yet-realized collection) — see packs/permutations-plus/compute_engine_twin.permutations-plus.sql.
INSERT INTO base_compute_engine_twin (collection, head, arity) VALUES
  ('permutations',         'Permutations',        1),
  ('integer_compositions', 'IntegerCompositions', 1),
  ('integer_partitions',   'IntegerPartitions',   1),
  ('set_partitions',       'SetPartitions',       1),
  ('set_compositions',     'SetCompositions',     1),
  ('subsets',              'Subsets',             1),
  ('k_subsets',            'KSubsets',            2),
  ('dyck_paths',           'DyckPaths',           1);
