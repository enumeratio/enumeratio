-- requires: meta-collections
-- Maps rooted at the meta-collections (issue #38). Two collection-scoped maps on `collections`:
--   carrier : a collection ↦ its carrier — an element of the `carriers` meta-collection (a clean element→element map).
--   bottom  : a collection ↦ its own (fiber, ∅, ∅) BOTTOM element — the whole target collection, no element selected.
-- Both are scope='collection' (bound to the `collections` domain). The carrier is text (a scalar, not a composite),
-- so they would not carrier-inherit even as 'carrier'-scoped; 'collection' scope states the binding directly and keeps
-- them off the sibling text meta-collections (`carriers`, `traits`).

-- carrier: the carrier type a collection sits on. base_collection.carrier IS an element of `carriers` (which
-- enumerates the DISTINCT base_collection.carrier), so the image lands cleanly in the carriers meta-collection — no
-- null shenanigans. Many collections share a carrier ⇒ the map is NOT injective (is_bijection stays false).
CREATE FUNCTION collection_carrier(id text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT carrier FROM base_collection WHERE base_collection.id = collection_carrier.id $$;

-- bottom: the named collection AS A WHOLE, no specific element chosen — the reserved (∅,∅) element of the element
-- model ((fiber, rank, value) with rank=∅ and value=∅). Each collection has its OWN element type, so there is no
-- universal record to return uniformly; the map yields the bottom's canonical TEXT — the whole-collection handle
-- X() / X(n=0..), the form the explorer follows to jump INTO the chosen collection. Dynamic dispatch by id; every
-- collection has a zero-arg constructor (all grade args DEFAULT NULL ⇒ the open, all-fibers handle).
CREATE FUNCTION collection_bottom(id text) RETURNS text LANGUAGE plpgsql STABLE AS $$
  DECLARE h text;
  BEGIN EXECUTE format('SELECT %I()::text', id) INTO h; RETURN h; END $$;

-- register both (codomain: carriers for the carrier map; collections for the bottom map — it lands back in the
-- collection universe, resolving an element to its whole-collection self).
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope) VALUES
  ('collections','carrier','collection_carrier','carriers','Carrier','collection'),
  ('collections','bottom','collection_bottom','collections','Bottom (whole collection)','collection');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('meta_collections','carrier: a collections element''s carrier IS an element of carriers','eq','permutation|true','the collection→carrier map lands on the right carriers element',$q$
    SELECT collection_carrier('permutations') || '|' ||
           (collection_carrier('permutations')::text <@ carriers())::text $q$),
  ('meta_collections','carrier over the meta-collections: collections/carriers/traits all sit on text','eq','text|text|text','the natural carrier map on the registries themselves',$q$
    SELECT collection_carrier('collections') || '|' || collection_carrier('carriers') || '|' || collection_carrier('traits') $q$),
  ('meta_collections','bottom: a collection ↦ its whole-collection handle (the (fiber,∅,∅) bottom, no element selected)','eq','permutations(size=0..)|collections()','the reserved bottom projected to the collection handle',$q$
    SELECT collection_bottom('permutations') || '|' || collection_bottom('collections') $q$),
  ('meta_collections','the reserved (∅,∅) record: a (fiber, ∅, ∅) element has no ordinality and no value','eq','true','rank=∅ ∧ value=∅ is the reserved bottom of the element model',$q$
    SELECT bool_and(ordinality(b) IS NULL AND (b).value IS NULL)::text
    FROM (SELECT ROW(f, NULL, NULL)::permutations_element b FROM fibers(permutations(3)) f) t $q$),
  ('meta_collections','both meta maps are collection-scoped on `collections` (no carrier-inheritance onto carriers/traits)','eq','carrier:collection|bottom:collection|0','scope binds them to the collections domain',$q$
    SELECT 'carrier:' || (SELECT scope FROM base_map WHERE collection='collections' AND map_id='carrier') || '|' ||
           'bottom:'  || (SELECT scope FROM base_map WHERE collection='collections' AND map_id='bottom') || '|' ||
           (SELECT count(*)::text FROM base_map_resolved WHERE collection IN ('carriers','traits') AND map_id IN ('carrier','bottom')) $q$);
