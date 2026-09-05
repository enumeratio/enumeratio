-- requires: meta-collections, tags, traits, words.stats, tri_strings, random_element, zigzag_composition
-- Statistics for the meta-collections — each becomes a COLUMN in the explorer's DataTable (the existing stat-column
-- machinery), so `collections` shows a collection's carrier / grade axes / tag + trait counts / restriction parent;
-- `carriers` shows how many collections sit on each; `traits` shows how many collections hold each. Registering the
-- carrier as a stat also makes GROUP BY carrier work through the existing grouping (the `collections_by_carrier` view,
-- for free). Value fns take the element's text id and read the registries; kept in a .stats file so the late tag/trait
-- assignment views exist at function-create time.
--
-- PERF (issue #55): the tag/trait COUNT columns read base_collection_tag and the RECURSIVE base_collection_trait view
-- (whose seed does to_regprocedure catalog probes) — done per row that is N+1 over ~200 collections, and traits alone
-- dominated the `collections` render (~6.6s). We snapshot the three count columns ONCE into keyed cache tables the
-- per-row value fns hit. This file is ordered LAST (see requires: it depends on every later collection/stat producer)
-- and the snapshot is built AFTER this file's own base_stat INSERT, so it sees the FINAL registry — including the
-- meta-collections' own has_stats trait. The cache-vs-live self-cert example below re-derives every count from the live
-- views and fails the suite if a future file ever loads later and re-stales the snapshot.

-- ── collections' columns (arg = a collection id) ─────────────────────────────────────────────────────────
-- title is a POLYMORPHIC-ish helper: for a collection element it is the display title (base_collection_meta), falling
-- back to the id. (For math elements a title could be concocted from notation ⊕ fiber notation — a future extension.)
CREATE FUNCTION meta_collection_title(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT title FROM base_collection_meta WHERE collection = v), v) $$;
CREATE FUNCTION meta_collection_carrier(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT carrier FROM base_collection WHERE id = v $$;
CREATE FUNCTION meta_collection_grades(v text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_length(grades, 1), 0) FROM base_catalog WHERE id = v $$;
CREATE FUNCTION meta_collection_parent(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT parent FROM base_collection_parent WHERE collection = v $$;

-- ── carriers' column (arg = a carrier name) ───────────────────────────────────────────────────────────────
CREATE FUNCTION meta_carrier_collections(v text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM base_collection WHERE carrier = v $$;

-- ── traits' columns (arg = a trait id) ────────────────────────────────────────────────────────────────────
-- The trait's editorial metadata (base_trait), surfaced as columns: its display title (falling back to the id) and
-- its one-line description. The description is what the traits table shows by default.
CREATE FUNCTION meta_trait_title(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT title FROM base_trait WHERE id = v), v) $$;
CREATE FUNCTION meta_trait_description(v text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT description FROM base_trait WHERE id = v $$;

-- The tags/traits/trait-collections value fns (meta_collection_tags, meta_collection_traits, meta_trait_collections)
-- read the cache tables built below; defined after those tables exist (check_function_bodies). Registered here so the
-- base_stat rows land first, which is what gives the meta-collections their has_stats trait before the snapshot.
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('collections', 'title',     'meta_collection_title',   'Title',      'text'),
  ('collections', 'carrier',   'meta_collection_carrier', 'Carrier',    'text'),
  ('collections', 'grades',    'meta_collection_grades',  'Grade axes', 'natural_numbers'),
  ('collections', 'tags',      'meta_collection_tags',    'Tags',       'natural_numbers'),
  ('collections', 'traits',    'meta_collection_traits',  'Traits',     'natural_numbers'),
  ('collections', 'restricts', 'meta_collection_parent',  'Restricts',  'text'),
  ('carriers',    'collections', 'meta_carrier_collections', 'Collections', 'natural_numbers'),
  ('traits',      'title',       'meta_trait_title',         'Title',       'text'),
  ('traits',      'description', 'meta_trait_description',    'Description', 'text'),
  ('traits',      'collections', 'meta_trait_collections',   'Collections', 'natural_numbers');

-- ── the count snapshot (built AFTER the base_stat INSERT above) ───────────────────────────────────────────
-- collection-keyed: tags + traits in one pass. Every collection appears (LEFT JOIN off base_collection), 0 where absent.
CREATE TABLE meta_collection_counts AS
  SELECT c.id AS collection, coalesce(tg.n, 0) AS tags, coalesce(tr.n, 0) AS traits
    FROM base_collection c
    LEFT JOIN (SELECT collection, count(*)::int n FROM base_collection_tag   GROUP BY collection) tg ON tg.collection = c.id
    LEFT JOIN (SELECT collection, count(*)::int n FROM base_collection_trait GROUP BY collection) tr ON tr.collection = c.id;
CREATE UNIQUE INDEX ON meta_collection_counts (collection);
-- trait-keyed: collections-per-trait (the `traits` meta-collection's column), same recursive-view cost.
CREATE TABLE meta_trait_counts AS
  SELECT trait, count(*)::int AS collections FROM base_collection_trait GROUP BY trait;
CREATE UNIQUE INDEX ON meta_trait_counts (trait);

CREATE FUNCTION meta_collection_tags(v text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT tags FROM meta_collection_counts WHERE collection = v), 0) $$;
CREATE FUNCTION meta_collection_traits(v text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT traits FROM meta_collection_counts WHERE collection = v), 0) $$;
CREATE FUNCTION meta_trait_collections(v text) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT collections FROM meta_trait_counts WHERE trait = v), 0) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('meta_collections','collections'' columns read the registry: permutations sits on the permutation carrier','eq','permutation','the carrier stat',$q$
    SELECT meta_collection_carrier('permutations') $q$),
  ('meta_collections','k_subsets shows 2 grade axes; and its restriction parent stat is null (it is not a restriction)','eq','2|','grade + parent columns',$q$
    SELECT meta_collection_grades('k_subsets')::text || '|' || coalesce(meta_collection_parent('k_subsets'), '') $q$),
  ('meta_collections','the traits column counts collections per trait: indexable holds many (> 10)','eq','true','the count the chips used to show',$q$
    SELECT (meta_trait_collections('indexable') > 10)::text $q$),
  ('meta_collections','every trait carries a non-empty title + description (the traits detail columns)','eq','true','base_trait editorial metadata is complete',$q$
    SELECT (NOT EXISTS (SELECT 1 FROM base_trait
                        WHERE title IS NULL OR btrim(title) = '' OR btrim(description) = ''))::text $q$),
  ('meta_collections','traits'' title + description stats read base_trait: has_stats → "has statistics"','eq','has statistics|At least one statistic is defined on the carrier.','the traits meta-collection detail columns',$q$
    SELECT meta_trait_title('has_stats') || '|' || meta_trait_description('has_stats') $q$),
  ('meta_collections','carriers'' column: the numeric carrier backs many collections (> 20)','eq','true','collections-per-carrier',$q$
    SELECT (meta_carrier_collections('numeric') > 20)::text $q$),
  ('meta_collections','the count caches match the live registry views (guards the snapshot against a later-loading file)','eq','ok|ok|ok','cache = live for tags/traits/trait-collections',$q$
    SELECT (CASE WHEN NOT EXISTS (SELECT 1 FROM meta_collection_counts c
                 FULL JOIN (SELECT collection, count(*)::int n FROM base_collection_tag GROUP BY collection) t USING (collection)
                 WHERE c.tags IS DISTINCT FROM coalesce(t.n, 0)) THEN 'ok' ELSE 'stale' END) || '|' ||
           (CASE WHEN NOT EXISTS (SELECT 1 FROM meta_collection_counts c
                 FULL JOIN (SELECT collection, count(*)::int n FROM base_collection_trait GROUP BY collection) t USING (collection)
                 WHERE c.traits IS DISTINCT FROM coalesce(t.n, 0)) THEN 'ok' ELSE 'stale' END) || '|' ||
           (CASE WHEN NOT EXISTS (SELECT 1 FROM meta_trait_counts c
                 FULL JOIN (SELECT trait, count(*)::int n FROM base_collection_trait GROUP BY trait) t USING (trait)
                 WHERE c.collections IS DISTINCT FROM coalesce(t.n, 0)) THEN 'ok' ELSE 'stale' END) $q$);
