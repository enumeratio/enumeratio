-- requires: maps-bijections
-- base_relation — the UNDIRECTED promotion of the paired directed bijections in base_map. A collection-scoped
-- bijection lives in base_map as TWO rows (forward on the domain, backward on the codomain, each naming the other as
-- `inverse`); here that pair is folded into ONE describable record: (domain, codomain, forward_fn, backward_fn,
-- is_bijection, is_order_iso). This is the object later work hangs metadata on — `prefer` (which direction the client
-- defaults to), `borrows` (an order-iso relation lets a collection borrow the other's ranking, #94), `findstat`,
-- category structure. See https://github.com/enumeratio/enumeratio/wiki/Maps-and-Bijections and issue #88.
--
-- TABLE, not a view: it is populated from base_map now, but exists to be EXTENDED (columns/rows hung on it later), so
-- it must be a mutable object with a stable identity, not a derived projection. The populate below is a one-shot
-- INSERT…SELECT off base_map — data-driven, so any collection-scoped bijection present at load time flows in for free.
-- codomain carries NO FK (mirrors base_map) — most collection-scoped codomains are real collections, but the
-- relation doesn't require it. backward_fn is NULL only when a map's reverse direction is genuinely unregistered.
CREATE TABLE base_relation (domain text NOT NULL REFERENCES base_collection, codomain text NOT NULL,
                            forward_fn text NOT NULL, backward_fn text,
                            is_bijection boolean NOT NULL DEFAULT false, is_order_iso boolean NOT NULL DEFAULT false,
                            PRIMARY KEY (domain, codomain, forward_fn));

-- fold each directed pair to a single row: keep the lexicographically-least (domain, map_id) direction as `forward`,
-- pull its partner's mapping_fn as `backward`. A map with no inverse keeps itself, backward NULL.
INSERT INTO base_relation (domain, codomain, forward_fn, backward_fn, is_bijection, is_order_iso)
  SELECT f.collection, f.codomain, f.mapping_fn, b.mapping_fn, f.is_bijection, f.is_order_iso
    FROM base_map f
    LEFT JOIN base_map b ON b.scope = 'collection' AND b.collection = f.codomain AND b.map_id = f.inverse
   WHERE f.scope = 'collection' AND f.is_bijection
     AND (f.inverse IS NULL OR ROW(f.collection, f.map_id) <= ROW(f.codomain, f.inverse));

-- base_relation_pack_finalize: re-derives the whole table from base_map — the same whole-catalog-sweep trap as
-- meta_collection_counts (meta-collections.stats.sql): the one-shot INSERT above only sees base_map rows present
-- at core-load time, so a pack's own collection-scoped bijection (e.g. partitions-plus' Euler distinct↔odd) is
-- invisible to it unless this re-runs after the pack loads too. Registered as a pack-scope finalizer (fires once
-- per pack via base_pack_finalize) rather than folded into the query above, which stays as the initial build.
CREATE FUNCTION base_relation_pack_finalize(p_pack text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  TRUNCATE base_relation;
  INSERT INTO base_relation (domain, codomain, forward_fn, backward_fn, is_bijection, is_order_iso)
    SELECT f.collection, f.codomain, f.mapping_fn, b.mapping_fn, f.is_bijection, f.is_order_iso
      FROM base_map f
      LEFT JOIN base_map b ON b.scope = 'collection' AND b.collection = f.codomain AND b.map_id = f.inverse
     WHERE f.scope = 'collection' AND f.is_bijection
       AND (f.inverse IS NULL OR ROW(f.collection, f.map_id) <= ROW(f.codomain, f.inverse));
END $$;
INSERT INTO base_finalizer (id, fn, description, scope) VALUES
  ('base_relation_pack_finalize', 'base_relation_pack_finalize',
   're-derives base_relation from base_map after each pack loads', 'pack');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- Every collection-scoped bijection registered so far is pack-owned (Euler → partitions-plus, crossing↔nesting →
-- trees-graphs, RSK → tableaux, binary_words_by_weight↔k_subsets → words-plus, #283 phase 3): core alone now
-- populates base_relation with ZERO rows, so the floor drops from the earlier "≥2 core-only" to ≥0 — the table/
-- finalizer machinery still runs correctly empty, and each pack's own relations.<pack>.sql adds + re-verifies its
-- rows once its pack loads (base_relation_pack_finalize re-derives the whole table per pack).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','the promotion never invents a non-bijection: every base_relation row IS a declared bijection (is_order_iso ⊃ is_bijection)','eq','true','the promotion pulls only is_bijection maps — holds vacuously true on zero rows, core alone',$q$
    SELECT bool_and(is_bijection)::text FROM base_relation $q$),
  ('relations','base_relation exists and is queryable core alone (a floor of 0 rows — every collection-scoped bijection today is pack-owned)','eq','true','the table + finalizer run correctly empty; each pack''s relations.<pack>.sql adds + re-verifies its own rows',$q$
    SELECT (count(*) >= 0)::text FROM base_relation $q$);
