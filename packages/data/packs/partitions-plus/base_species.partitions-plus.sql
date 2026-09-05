-- requires: base_species, distinct_partitions
-- (distinct_partitions is realized via SELECT base_restrict(...), not a literal `INSERT INTO base_collection`, so
-- it carries no implicit `collection` tag for requires-tag to pull in — named explicitly instead.)
-- partitions-plus half of sqlsrc/base_species.sql's partition-product-family block (#283 phase 3 extraction) —
-- split out because base_species is a core-owned TABLE and this pack may only INSERT rows into it (§3.3 pack
-- contract), never edit core's own INSERT statement.

INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('distinct_partitions','∏(1+X^k)', '\prod_{k\ge1}(1+x^k)', 'partitions into DISTINCT parts; q(n) = 1,1,1,2,2,3,…', true);
