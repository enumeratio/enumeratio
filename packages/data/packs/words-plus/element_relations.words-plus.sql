-- requires: element_relations, symmetry_orbit_maps, k_ary_word_classes
-- words-plus half of sqlsrc/element_relations.sql's words/rotation canonical_fn verification (#283 phase 3
-- extraction) — split out because these examples call word_canonical_rotation (symmetry_orbit_maps.sql) and
-- is_word_necklace (k_ary_word_classes.sql), both words-plus's own functions: they don't exist loading core alone,
-- even though the underlying carrier (word) and the base_element_relation row for words/rotation stay core.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('element_relations', 'the orbit is a well-defined class: every member shares one canonical representative, words(4,2)',
   'eq', 'true', 'orbit:<rel> is the kernel of the representative map',$q$
    SELECT bool_and(word_canonical_rotation(o) = word_canonical_rotation((e).value))::text
      FROM elements(words(4,2)) e, LATERAL word_rotation_orbit((e).value) o $q$),
  ('element_relations', 'the DERIVED representative (rank-least orbit member) equals the declared canonical_fn, words(4,2)',
   'eq', 'true', 'canonical_fn is optional — absent, the rep is the least member of forward_fn(x)',$q$
    SELECT bool_and(
      word_canonical_rotation((e).value) =
      (SELECT o FROM word_rotation_orbit((e).value) o ORDER BY (o).letters LIMIT 1))::text
      FROM elements(words(4,2)) e $q$),
  ('element_relations', 'orbit count over words(n,2) = the necklace count (one canonical rep per orbit), n=1..6',
   'eq', 'true', 'GROUP BY orbit:rotation = the Pólya count = the registered necklace restriction',$q$
    SELECT bool_and(reps = necklaces)::text FROM (
      SELECT n,
             (SELECT count(DISTINCT word_canonical_rotation((e).value)) FROM elements(words(n,2)) e) reps,
             (SELECT count(*) FROM elements(words(n,2)) e WHERE is_word_necklace((e).value)) necklaces
        FROM generate_series(1,6) n) t $q$);
