-- requires: realizer
-- The category vocabulary + collection→category assignment. Categories are the classification a collection BELONGS
-- to; `requires` names the traits the classification entails (its axioms). The coarse mathematical/internal split is
-- the top for now — the category-theoretic lattice (Posets/Lattices/Groups, with base_map as morphisms) layers on
-- later. Organizational buckets (lattice_paths, trees) will be a SEPARATE tag layer, deliberately not here.

INSERT INTO base_category (id, title, description, parents, requires) VALUES
  ('mathematical', 'mathematical', 'A mathematical object — defined by structure, fixed for all time.', '{}', '{immutable}'),
  ('internal',     'internal',     'A system collection — catalog or configuration surfaced as a collection.',  '{}', '{}');

-- collection → its primary category: internal if it's in base_internal (catalog/config surfaced as a collection),
-- else mathematical. Closed over `parents` at read time (flat for now).
CREATE VIEW base_collection_category AS
  SELECT id AS collection,
         CASE WHEN id IN (SELECT collection FROM base_internal) THEN 'internal' ELSE 'mathematical' END AS category
    FROM base_catalog;
