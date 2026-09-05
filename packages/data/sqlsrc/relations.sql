-- requires: maps-bijections, binary_words_by_weight, standard_tableau_pairs.maps
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

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','each collection-scoped bijection PAIR is ONE base_relation row (a floor of 4: Euler, crossing↔nesting, binary_words↔k_subsets, RSK — later batches only add rows)','eq','true','a floor, not an exact count — new collection-scoped bijections add rows',$q$
    SELECT (count(*) >= 4)::text FROM base_relation $q$),
  ('relations','a known bijection appears as one relation: distinct↔odd, both directions named','eq','distinct_partitions|odd_partitions|euler_distinct_to_odd|euler_odd_to_distinct|t|f','domain|codomain|forward|backward|is_bijection|is_order_iso',$q$
    SELECT domain||'|'||codomain||'|'||forward_fn||'|'||coalesce(backward_fn,'∅')||'|'||left(is_bijection::text,1)||'|'||left(is_order_iso::text,1)
      FROM base_relation WHERE domain='distinct_partitions' $q$),
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
  -- the NON-order-iso relations are NOT order-preserving on their windows (the flag discriminates, not all-true):
  ('relations','Euler is a bijection but NOT order-iso: its window rank order does not line up','eq','false','discriminating check — distinct↦odd is not order-preserving',$q$
    SELECT bool_and(
      ARRAY(SELECT notation(euler_distinct_to_odd((e).value)) FROM elements(distinct_partitions(n)) e ORDER BY ordinality(e))
    = ARRAY(SELECT notation((o).value) FROM elements(odd_partitions(n)) o ORDER BY ordinality(o)))::text
    FROM generate_series(0,10) n $q$),
  -- forward∘backward = id on samples: the relation round-trips through both stored fns.
  ('relations','forward∘backward = id on samples (Euler): backward(forward(d)) = d','eq','true','round-trip through the relation''s two fns',$q$
    SELECT bool_and(euler_odd_to_distinct(euler_distinct_to_odd((e).value)) = (e).value)::text
      FROM generate_series(0,12) n, LATERAL elements(distinct_partitions(n)) e $q$),
  ('relations','forward∘backward = id on samples (binary_words↔k_subsets): backward(forward(w)) = w','eq','true','the order-iso relation round-trips too',$q$
    SELECT bool_and(binary_word_of_subset(subset_of_binary_word((e).value)) = (e).value)::text
      FROM generate_series(0,5) k, LATERAL elements(binary_words_by_weight(5,k)) e $q$),
  ('relations','RSK is promoted with both directions named (#153): forward perm_rsk, backward the tableau-pair inverse','eq','permutations|standard_tableau_pairs|perm_rsk|standard_tableau_pair_to_perm|t|f','the reverse map is registered — no more carrier blocker',$q$
    SELECT domain||'|'||codomain||'|'||forward_fn||'|'||coalesce(backward_fn,'∅')||'|'||left(is_bijection::text,1)||'|'||left(is_order_iso::text,1)
      FROM base_relation WHERE forward_fn='perm_rsk' $q$);
