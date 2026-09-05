-- requires: identities, polytope-collections
-- The polytope correspondence for the two curated function-property attributes (#283 phase 2.2 split, see
-- sqlsrc/identities.sql's base_function_attribute_polytope comment): 'associativity' -> associahedron,
-- 'commutativity' -> permutahedron. Lives here, not in core, because both target collections are this pack's rows.
INSERT INTO base_function_attribute_polytope (attribute, collection) VALUES
  ('associativity', 'associahedron'),
  ('commutativity', 'permutahedron');
