-- requires: representations, polytope-collections
-- These two representations.sql examples asserted CARRIER-inherited base_repr rows on permutahedron/cross_polytope
-- — both packs/polytopes collections (#283 phase 2.1/2.2 split) — so under `--packs core` alone they fail (the
-- collections don't exist yet). Moved here, alongside this pack's own collections, rather than left in core.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','the signed_subset members repr is CARRIER-inherited: cross_polytope resolves it at unicode and latex','eq','true','base_repr_resolved carries the signed_subsets-registered repr to its polytope carrier sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'cross_polytope' AND repr = 'members' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'cross_polytope' AND repr = 'members' AND medium = 'latex'))::text $q$),
  ('representations','the set_composition blocks repr is CARRIER-inherited: permutahedron resolves it at unicode and latex','eq','true','base_repr_resolved carries the set_compositions-registered repr to its polytope carrier sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'permutahedron' AND repr = 'blocks' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'permutahedron' AND repr = 'blocks' AND medium = 'latex'))::text $q$);
