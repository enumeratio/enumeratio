-- requires: function_impls, k_part_partitions, identities.partitions-plus
-- partitions-plus half of sqlsrc/function_impls.sql's impl rows (#283 phase 3 extraction) — split out because
-- base_function_impl is a core-owned TABLE and this pack may only INSERT rows into it (§3.3 pack contract),
-- never edit core's own INSERT statement. integer_partition_k_count's abstract base_function row stays in core's
-- identities.sql (the concept is engine-agnostic); its concrete impl_ref (k_part_partition_count) lives here,
-- next to the function itself (k_part_partitions.sql).

INSERT INTO base_function_impl (function, engine, impl_ref, arg_types, return_type, representation, note) VALUES
  ('integer_partition_k_count', 'pg', 'k_part_partition_count', '{int,int}', 'numeric', 'numeric', NULL),
  ('integer_partition_k_count', 'ts', 'k_part_partition_count', '{int,int}', 'numeric', 'float64', NULL);
