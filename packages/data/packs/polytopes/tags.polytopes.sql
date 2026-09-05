-- requires: tags, polytope-collections, simplex
-- This pack's slice of the editorial tag assignments (#283 phase 2.2 split, mirroring traits.polytopes.sql): the
-- 'polytope' tag on associahedron/cross_polytope/permutahedron, and simplex's 'selection' + 'polytope' tags — all
-- four are this pack's own collections. Left in core's tags.sql before this split, that broke `--packs core`: the
-- editorial view (base_collection_tag) doesn't filter to rows that exist in base_collection, so tagging a
-- not-yet-loaded collection silently produced tag rows with no backing collection.
INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('polytope', 'associahedron'), ('polytope', 'cross_polytope'), ('polytope', 'permutahedron'),
  ('selection', 'simplex'), ('polytope', 'simplex')
) AS a(tag, collection);
