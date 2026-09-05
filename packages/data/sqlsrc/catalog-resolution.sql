-- requires: realizer
-- Carrier-level inheritance of the catalog facets. A statistic or map is a function ON A CARRIER — its
-- value_fn / mapping_fn takes the carrier type — so it applies to EVERY collection built on that carrier, not just
-- the one that happened to register it. base_stat_resolved / base_map_resolved expose that: a restricted variant
-- (compositions_into_k_parts, square_partitions, non_crossing_partitions, …) inherits its base carrier's stats and
-- maps for free, with `own = false`. The plain base_stat / base_map tables are UNTOUCHED — the registry-count
-- examples still count only the rows a collection registered itself; inheritance lives in these views.
--
-- Restricted to COMPOSITE carriers (pg_type.typtype = 'c'): the number families all share the primitive `numeric`
-- carrier, and blanket-inheriting a stat across every number collection would be wrong — the composite-only filter
-- keeps `numeric` (and other scalar/domain carriers) from participating. (Domain carriers — even_permutation and
-- friends — inherit at the SQL level already via function resolution; surfacing them here is a later pass.)
-- One imprecision, by design: an inherited MAP keeps the codomain the base collection registered (a k-part
-- composition reversed is still k parts, but the codomain reads `integer_compositions`). The image is still valid.

-- Per-collection suppression of an otherwise-inherited stat (#292): carrier inheritance has no notion of a
-- positivity precondition some stats carry (area/bounce/dinv assume the path stays weakly above the axis) and
-- others don't (peaks/height/major_index/...). Rather than redesign resolution around validity predicates, a
-- suppressed row here just removes one (collection, stat_id) pair from base_stat_resolved — narrow, doesn't
-- generalize, but nothing today needs it to. Only meaningful for an INHERITED stat; suppressing a collection's
-- own stat_id would just be deleting the base_stat row instead.
CREATE TABLE base_stat_suppressed (collection text NOT NULL REFERENCES base_collection, stat_id text NOT NULL,
                                    reason text NOT NULL, PRIMARY KEY (collection, stat_id));

CREATE VIEW base_stat_resolved AS
  SELECT DISTINCT ON (c.id, s.stat_id)
         c.id AS collection, s.stat_id, s.value_fn, s.title, s.codomain, (s.collection = c.id) AS own
  FROM base_collection c
  JOIN base_stat s ON s.collection = c.id
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_type t ON t.oid = p.proargtypes[0]
               WHERE p.proname = s.value_fn AND p.pronargs >= 1 AND t.typtype = 'c' AND t.typname = c.carrier)
  WHERE NOT EXISTS (SELECT 1 FROM base_stat_suppressed x WHERE x.collection = c.id AND x.stat_id = s.stat_id)
  ORDER BY c.id, s.stat_id, (s.collection = c.id) DESC;   -- a collection's OWN row wins a stat_id collision

CREATE VIEW base_map_resolved AS
  SELECT DISTINCT ON (c.id, m.map_id)
         c.id AS collection, m.map_id, m.mapping_fn, m.codomain, m.title, m.findstat,
         m.scope, m.inverse, m.is_bijection, m.is_order_iso, (m.collection = c.id) AS own
  FROM base_collection c
  JOIN base_map m ON m.collection = c.id
    -- carrier-inheritance applies ONLY to carrier-scoped maps; collection-scoped maps resolve to their own domain.
    OR (m.scope = 'carrier' AND EXISTS (SELECT 1 FROM pg_proc p JOIN pg_type t ON t.oid = p.proargtypes[0]
               WHERE p.proname = m.mapping_fn AND p.pronargs >= 1 AND t.typtype = 'c' AND t.typname = c.carrier))
  ORDER BY c.id, m.map_id, (m.collection = c.id) DESC;

-- reprs are carrier renderings too (render_fn takes the carrier), so a restricted variant inherits the alternate
-- notations of its base — e.g. derangements gets permutation cycle notation, non_crossing_partitions gets the
-- set-partition block form. The canonical flag carries over unchanged (it tracks the carrier's ::text codec).
-- One row PER MEDIUM sibling (a repr with a katex sibling resolves to two rows here, same repr, different medium) —
-- the client picks the medium it wants (renderExpr, core.ts), falling back to unicode when the requested medium has
-- no sibling registered for that repr.
CREATE VIEW base_repr_resolved AS
  SELECT DISTINCT ON (c.id, r.repr, r.medium)
         c.id AS collection, r.repr, r.render_fn, r.parse_fn, r.title, r.canonical, r.scope, r.medium, r.alphabet,
         (r.collection = c.id) AS own
  FROM base_collection c
  JOIN base_repr r ON r.collection = c.id
    -- carrier-inheritance applies ONLY to carrier-scoped reprs; a collection-scoped repr resolves to its own domain.
    OR (r.scope = 'carrier' AND EXISTS (SELECT 1 FROM base_collection rc   -- inherit from any collection sharing this carrier
               WHERE rc.id = r.collection AND rc.carrier = c.carrier AND c.carrier IS NOT NULL))
  ORDER BY c.id, r.repr, r.medium, (r.collection = c.id) DESC;

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog','compositions_into_k_parts inherits its composition-carrier stats (registers none itself)','eq','0|true','own base_stat rows | any resolved stats (a floor — the carrier may gain more)',$q$
    SELECT (SELECT count(*) FROM base_stat WHERE collection = 'compositions_into_k_parts')::text || '|' ||
           (SELECT count(*) > 0 FROM base_stat_resolved WHERE collection = 'compositions_into_k_parts')::text $q$),
  ('catalog','square_partitions inherits the integer_partition stats (all marked inherited)','eq','true|false','any resolved stats (a floor — the carrier may gain more) | any own?',$q$
    SELECT (SELECT count(*) > 0 FROM base_stat_resolved WHERE collection = 'square_partitions')::text || '|' ||
           (SELECT bool_or(own)::text FROM base_stat_resolved WHERE collection = 'square_partitions') $q$),
  ('catalog','non_crossing_partitions inherits set_partitions stats + maps via the shared carrier','eq','true','resolved stats include blocks; resolved maps include shape',$q$
    SELECT (EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_crossing_partitions' AND stat_id = 'blocks') AND
            EXISTS (SELECT 1 FROM base_map_resolved WHERE collection = 'non_crossing_partitions' AND map_id = 'shape'))::text $q$),
  ('catalog','inheritance is carrier-gated: the numeric families do NOT cross-inherit (own stats OK; #169)','eq','0','natural_numbers may register its OWN numeric stats, but inherits NONE from sibling numeric collections (numeric is a scalar carrier)',$q$
    SELECT count(*)::text FROM base_stat_resolved WHERE collection = 'natural_numbers' AND NOT own $q$),
  ('catalog','a base collection keeps exactly its own stats (nothing spurious inherited)','eq','true','integer_compositions resolved = its own registry',$q$
    SELECT ((SELECT count(*) FROM base_stat_resolved WHERE collection = 'integer_compositions') =
            (SELECT count(*) FROM base_stat WHERE collection = 'integer_compositions'))::text $q$),
  ('catalog','derangements inherit at least the permutation reprs (oneline, cycle, + the two species readings)','eq','true','resolved reprs via the shared permutation carrier (a floor — more may be added)',$q$
    SELECT (array_agg(repr) @> ARRAY['cycle','cycle_species','oneline','species'])::text FROM base_repr_resolved WHERE collection = 'derangements' $q$),
  ('catalog','the inherited canonical repr is preserved: derangements canonical repr is oneline','eq','oneline','canonical flag carries over',$q$
    SELECT repr FROM base_repr_resolved WHERE collection = 'derangements' AND canonical $q$);
