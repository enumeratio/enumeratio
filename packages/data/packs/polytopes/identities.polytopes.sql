-- requires: identities, polytope-collections
-- The polytope correspondence for the two curated Wolfram-attribute identities (#283 phase 2.2 split, see
-- sqlsrc/identities.sql's base_function_attribute_polytope comment): 'flat' -> associahedron, 'orderless' ->
-- permutahedron. Lives here, not in core, because both target collections are this pack's rows.
INSERT INTO base_function_attribute_polytope (attribute, collection) VALUES
  ('flat', 'associahedron'),
  ('orderless', 'permutahedron');
