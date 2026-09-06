-- requires: tags
-- words-plus half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out because
-- base_collection_tag does not filter to existing base_collection rows: an orphaned row here would break the
-- count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets/
-- partitions-plus/permutations-plus/tableaux extractions hit. Tag DEFINITIONS (base_tag) stay core; only the
-- per-collection assignment rows for this pack's collections move. `words`/`binary_words` are core carriers and
-- keep their 'word' tag rows in core's tags.sql.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('word', 'k_necklaces'), ('word', 'k_bracelets'), ('word', 'k_lyndon_words'), ('word', 'binary_palindromes'),
  ('word', 'primitive_binary_strings'), ('word', 'lyndon_words'), ('word', 'binary_necklaces'), ('word', 'binary_bracelets'),
  ('word', 'gray_codes'), ('word', 'ascent_sequences'), ('word', 'restricted_growth_strings'),
  ('word', 'fib_strings'), ('word', 'tri_strings'), ('word', 'lucas_strings'),
  ('set_partition', 'restricted_growth_strings')
) AS a(tag, collection);
