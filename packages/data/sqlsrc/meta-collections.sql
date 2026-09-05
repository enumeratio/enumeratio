-- requires: realizer
-- META-COLLECTIONS — the catalog's own registries surfaced AS collections, so the explorer browses them through the
-- same elements/cardinality/<@ surface as any collection (and can start from `collections` at its root, jumping into a
-- chosen collection). Each is ungraded (one fiber = the whole registry), carried by a bare text id/name; per-element
-- DETAIL (a collection's carrier/tags/traits/parent, a carrier's collections, a trait's count) will attach as STATS →
-- explorer columns, a follow-up. All read their registry LIVE, so load order does not matter for the enumeration.
-- base_collection / base_trait exist from realizer.sql, so the function bodies resolve regardless of collection order.

-- ── collections: every realized collection, carried by its id (includes itself) ──────────────────────────
CREATE TYPE collections_fiber AS (unit unit);
CREATE FUNCTION fiber_elements(f collections_fiber, element_limit int) RETURNS SETOF text LANGUAGE sql STABLE AS $$
  SELECT id FROM base_collection ORDER BY id LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f collections_fiber) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT count(*)::numeric FROM base_collection $$;
CREATE FUNCTION contains_in_fiber(f collections_fiber, v text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM base_collection WHERE id = v) $$;
INSERT INTO base_collection VALUES ('collections', 'text');
SELECT base_realize('collections');
INSERT INTO base_internal VALUES ('collections');   -- the catalog itself, not a mathematical object

-- ── carriers: the distinct carrier types collections sit on ───────────────────────────────────────────────
CREATE TYPE carriers_fiber AS (unit unit);
CREATE FUNCTION fiber_elements(f carriers_fiber, element_limit int) RETURNS SETOF text LANGUAGE sql STABLE AS $$
  SELECT DISTINCT carrier FROM base_collection ORDER BY carrier LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f carriers_fiber) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT carrier)::numeric FROM base_collection $$;
CREATE FUNCTION contains_in_fiber(f carriers_fiber, v text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM base_collection WHERE carrier = v) $$;
INSERT INTO base_collection VALUES ('carriers', 'text');
SELECT base_realize('carriers');
INSERT INTO base_internal VALUES ('carriers');   -- the catalog itself, not a mathematical object

-- ── traits: the capability/organization trait vocabulary (base_trait) ─────────────────────────────────────
CREATE TYPE traits_fiber AS (unit unit);
CREATE FUNCTION fiber_elements(f traits_fiber, element_limit int) RETURNS SETOF text LANGUAGE sql STABLE AS $$
  SELECT id FROM base_trait ORDER BY id LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f traits_fiber) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT count(*)::numeric FROM base_trait $$;
CREATE FUNCTION contains_in_fiber(f traits_fiber, v text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM base_trait WHERE id = v) $$;
INSERT INTO base_collection VALUES ('traits', 'text');
SELECT base_realize('traits');
INSERT INTO base_internal VALUES ('traits');   -- the catalog itself, not a mathematical object

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('meta_collections','collections tracks the registry, contains itself, excludes a non-collection','eq','true|true|false','the catalog as a collection',$q$
    SELECT (cardinality(collections()) = (SELECT count(*) FROM base_collection))::text || '|' ||
           ('collections'::text <@ collections())::text || '|' ||
           ('not_a_collection'::text <@ collections())::text $q$),
  ('meta_collections','carriers enumerates the distinct carriers: numeric ∈, permutation ∈, and it self-references text','eq','true|true|true','every collection sits on a carrier',$q$
    SELECT ('numeric'::text <@ carriers())::text || '|' ||
           ('permutation'::text <@ carriers())::text || '|' ||
           ('text'::text <@ carriers())::text $q$),
  ('meta_collections','traits enumerates the vocabulary: indexable ∈, samplable ∈, made_up ∉','eq','true|true|false','base_trait as a collection',$q$
    SELECT ('indexable'::text <@ traits())::text || '|' ||
           ('samplable'::text <@ traits())::text || '|' ||
           ('made_up'::text <@ traits())::text $q$),
  ('meta_collections','unnest(h) = carriers(h) over a SCALAR-carrier handle','eq','true','carriers/unnest project a text-carrier collection too',$q$
    SELECT ((SELECT count(*) FROM unnest(traits())) = (SELECT count(*) FROM carriers(traits()))
        AND (SELECT array_agg(x ORDER BY x) FROM unnest(traits()) x)
          = (SELECT array_agg(x ORDER BY x) FROM carriers(traits()) x))::text $q$);

-- per-collection living examples (suite = the collection id, so each row's collection is tagged) ──────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('collections','the catalog as a collection: cardinality tracks the registry, contains itself, excludes a non-id','eq','true|true|false','collections() over base_collection',$q$
    SELECT (cardinality(collections()) = (SELECT count(*) FROM base_collection))::text || '|' ||
           ('collections'::text <@ collections())::text || '|' ||
           ('not_a_collection'::text <@ collections())::text $q$),
  ('carriers','the distinct carriers as a collection: numeric ∈, permutation ∈, and it self-references text; made_up ∉','eq','true|true|true|false','carriers() over the distinct base_collection.carrier',$q$
    SELECT ('numeric'::text <@ carriers())::text || '|' ||
           ('permutation'::text <@ carriers())::text || '|' ||
           ('text'::text <@ carriers())::text || '|' ||
           ('made_up'::text <@ carriers())::text $q$);
