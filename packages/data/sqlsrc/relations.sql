-- requires: maps-bijections, binary_words_by_weight
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
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','each collection-scoped bijection PAIR is ONE base_relation row (a floor of 2 core-only: integer_compositions↔subsets, binary_words↔k_subsets; Euler, crossing↔nesting, increasing_binary_trees↔permutations and RSK are pack-owned and only add rows once their pack loads too — later batches only add rows)','eq','true','a floor, not an exact count — new collection-scoped bijections add rows',$q$
    SELECT (count(*) >= 2)::text FROM base_relation $q$),
  ('relations','the order-iso relation is flagged: binary_words_by_weight ↔ k_subsets is the only is_order_iso row','eq','binary_words_by_weight→k_subsets','is_order_iso holds exactly where declared',$q$
    SELECT string_agg(domain||'→'||codomain, ',' ORDER BY domain) FROM base_relation WHERE is_order_iso $q$),
  ('relations','every relation IS a declared bijection (is_order_iso ⊃ is_bijection: no non-bijective relations)','eq','true','the promotion pulls only is_bijection maps',$q$
    SELECT bool_and(is_bijection)::text FROM base_relation $q$),
  -- is_order_iso VERIFIED (window where both sides finite): the flagged relation's forward map is order-preserving —
  -- the k-th element of binary_words_by_weight(n,k) maps to the k-th element of k_subsets(n,k), n=0..6.
  ('relations','is_order_iso verified: the declared order-iso forward map preserves rank order, n=0..6','eq','true','k-th domain element ↦ k-th codomain element',$q$
    SELECT bool_and(
      ARRAY(SELECT notation(subset_of_binary_word((e).value)) FROM elements(binary_words_by_weight(n,k)) e ORDER BY ordinality(e))
    = ARRAY(SELECT notation((s).value) FROM elements(k_subsets(n,k)) s ORDER BY ordinality(s)))::text
    FROM base_relation r, LATERAL generate_series(0,6) n, LATERAL generate_series(0,n) k
   WHERE r.is_order_iso AND r.domain='binary_words_by_weight' $q$),
  -- the NON-order-iso relations are NOT order-preserving on their windows (the flag discriminates, not all-true) —
  -- the Euler (distinct↔odd) example moved to the partitions-plus pack (relations.partitions-plus.sql, #283); the
  -- RSK example moved to the tableaux pack (relations.tableaux.sql, #283 phase 3 lane 2) — its forward base_map row
  -- now lives in packs/tableaux/maps-bijections.tableaux.sql (codomain standard_tableau_pairs is pack-owned).
  -- forward∘backward = id on samples: the relation round-trips through both stored fns.
  ('relations','forward∘backward = id on samples (binary_words↔k_subsets): backward(forward(w)) = w','eq','true','the order-iso relation round-trips too',$q$
    SELECT bool_and(binary_word_of_subset(subset_of_binary_word((e).value)) = (e).value)::text
      FROM generate_series(0,5) k, LATERAL elements(binary_words_by_weight(5,k)) e $q$);
