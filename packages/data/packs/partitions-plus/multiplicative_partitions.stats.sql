-- requires: multiplicative_partitions, realizer, utilities
-- multiplicative_partitions statistics — factors (length) and largest_factor, read directly off the carrier (0 for
-- the trivial n=1 empty-product partition). The carrier is stored non-increasing, so largest_factor is simply the
-- first entry — kept as a max() for robustness, matching ordered_factorizations' twin definition.

-- ── statistics (carrier: multiplicative_partition(factors int[]), non-increasing, every entry ≥ 2) ─────
-- factors: the number of factors (0 for the empty product, n=1).
CREATE FUNCTION multiplicative_partition_num_factors(p multiplicative_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((p).factors, 1), 0) $$;
-- largest_factor: the maximum factor (0 for the empty product) — the first entry, since the carrier is non-increasing.
CREATE FUNCTION multiplicative_partition_largest_factor(p multiplicative_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((p).factors) x), 0) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('multiplicative_partitions','factors','multiplicative_partition_num_factors','Number of factors','natural_numbers'),
  ('multiplicative_partitions','largest_factor','multiplicative_partition_largest_factor','Largest factor','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- multiplicative_partitions(12) in floor order (from multiplicative_partitions.sql's own example):
--   3·2·2, 4·3, 6·2, 12
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multiplicative_partitions','factors over multiplicative_partitions(12) in floor order is 3,2,2,1','eq','3,2,2,1','sequence length per partition',$q$
    SELECT string_agg(multiplicative_partition_num_factors((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(multiplicative_partitions(12)) e $q$),
  ('multiplicative_partitions','largest_factor over multiplicative_partitions(12) in floor order is 3,4,6,12','eq','3,4,6,12','the leading (largest) entry per partition',$q$
    SELECT string_agg(multiplicative_partition_largest_factor((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(multiplicative_partitions(12)) e $q$),
  ('multiplicative_partitions','largest_factor equals the first array entry (non-increasing carrier), over multiplicative_partitions(36)','eq','true','structural check against the storage invariant',$q$
    SELECT bool_and(multiplicative_partition_largest_factor((e).value) = coalesce(((e).value).factors[1], 0))::text
      FROM elements(multiplicative_partitions(36)) e $q$),
  ('multiplicative_partitions','n=1: the empty product has factors=0, largest_factor=0','eq','0|0','the trivial "1" partition',$q$
    SELECT multiplicative_partition_num_factors((unrank(multiplicative_partitions(1),0)).value)::text || '|' ||
           multiplicative_partition_largest_factor((unrank(multiplicative_partitions(1),0)).value)::text $q$),
  ('multiplicative_partitions','largest_factor never exceeds n, over multiplicative_partitions(48)','eq','true','no single factor can exceed the product',$q$
    SELECT bool_and(multiplicative_partition_largest_factor((e).value) <= 48)::text FROM elements(multiplicative_partitions(48)) e $q$);
