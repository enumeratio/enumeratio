-- requires: identities
-- partitions-plus half of sqlsrc/identities.sql's base_function ledger (#283 phase 3 extraction) — split out
-- because base_function is a core-owned TABLE and this pack may only INSERT rows into it (§3.3 pack contract),
-- never edit core's own INSERT statement. integer_partition_k_count's impl row lives alongside it in this
-- pack's function_impls.partitions-plus.sql.

INSERT INTO base_function (id, title, description) VALUES
  ('integer_partition_k_count', 'k-part partition count',
   'p(n,k) — the number of integer partitions of n into exactly k parts.');
