-- requires: realizer, collection-meta
-- requires-tag: collection
-- issue #147: the catalog is supposed to self-describe via COMMENT ON / pg_description, but nothing the realizer
-- generates ever got one. This emits COMMENT ON FUNCTION / COMMENT ON TYPE for the generated per-collection
-- surface, SOURCED from existing metadata — never invented text:
--   base_collection_meta (title/description) → the handle type <coll>, the element type <coll>_element, the
--     constructor(s), and the key handle-level functions (cardinality/elements/unrank/fibers/random_element/
--     carriers/unnest/contains/range).
--   base_stat/base_repr/base_map (their own `title`) → the stat value_fn / repr render_fn / map mapping_fn they
--     register (carrier-level functions, commented once regardless of how many collections share the carrier).
-- A collection with no meta row (or a facet row with no title) is skipped, not guessed at. Runs LAST — after every
-- collection (`requires-tag: collection`) and the meta seed (`collection-meta`) — so every source row it might
-- want already exists; base_realize itself can't do this inline because collection files load in an order that
-- doesn't guarantee collection-meta.sql has landed yet.

-- verb per handle-level function: how to phrase "<verb><title>."
CREATE FUNCTION base_comment_verb(fn text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE fn
    WHEN 'cardinality'     THEN 'Counts the elements of '
    WHEN 'elements'        THEN 'Enumerates the elements of '
    WHEN 'unrank'          THEN 'Returns the element at a given global rank in '
    WHEN 'fibers'          THEN 'Unfolds the graded fibers of '
    WHEN 'random_element'  THEN 'Draws a uniform-random element of '
    WHEN 'carriers'        THEN 'Materializes the carrier values bound by '
    WHEN 'unnest'          THEN 'Streams the carrier values bound by '
    WHEN 'contains'        THEN 'Tests membership in '
    WHEN 'range'           THEN 'Returns a lazy element range over '
    ELSE fn || ' over '
  END $$;

-- base_comment_collection(coll): comment the handle/element types + constructor + key handle-level functions for
-- one collection, sourced from its base_collection_meta row. Returns how many COMMENT ONs it issued (0 if the
-- collection has no meta).
CREATE FUNCTION base_comment_collection(coll text) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  meta base_collection_meta%ROWTYPE; label text; n int := 0; r record; handle_type regtype;
BEGIN
  SELECT * INTO meta FROM base_collection_meta WHERE collection = coll;
  IF meta.collection IS NULL OR (meta.title IS NULL AND meta.description IS NULL) THEN RETURN 0; END IF;
  label := coalesce(meta.title, coll);
  handle_type := to_regtype(format('%I', coll));
  IF handle_type IS NULL THEN RETURN 0; END IF;   -- not realized (shouldn't happen this late, but stay defensive)

  EXECUTE format('COMMENT ON TYPE %I IS %L', coll,
    label || CASE WHEN meta.description IS NOT NULL THEN ' — ' || meta.description ELSE '' END);
  n := n + 1;

  IF to_regtype(format('%I', coll || '_element')) IS NOT NULL THEN
    EXECUTE format('COMMENT ON TYPE %I IS %L', coll || '_element', 'An element of ' || label || '.');
    n := n + 1;
  END IF;

  -- constructor(s): every function named exactly `coll` returning the handle type (arity varies by grade count)
  FOR r IN SELECT pg_get_function_identity_arguments(p.oid) AS args
             FROM pg_proc p WHERE p.proname = coll AND p.prorettype = handle_type
  LOOP
    EXECUTE format('COMMENT ON FUNCTION %I(%s) IS %L', coll, r.args,
      'Constructs a handle for ' || label || '.' || CASE WHEN meta.description IS NOT NULL THEN ' ' || meta.description ELSE '' END);
    n := n + 1;
  END LOOP;

  -- key handle-level functions (first arg = the handle type)
  FOR r IN SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
             FROM pg_proc p
            WHERE p.pronargs > 0 AND p.proargtypes[0] = handle_type
              AND p.proname IN ('cardinality','elements','unrank','fibers','random_element','carriers','unnest','contains','range')
  LOOP
    EXECUTE format('COMMENT ON FUNCTION %I(%s) IS %L', r.proname, r.args, base_comment_verb(r.proname) || label || '.');
    n := n + 1;
  END LOOP;

  RETURN n;
END $$;

-- base_comment_facets(): comment the stat/repr/map functions registered across every collection, sourced from
-- their own `title` (skipped when absent). These are carrier-level functions — commented once per function object
-- even if several collections share the carrier and would otherwise re-resolve to the same fn.
CREATE FUNCTION base_comment_facets() RETURNS int LANGUAGE plpgsql AS $$
DECLARE r record; sig text; n int := 0;
BEGIN
  FOR r IN SELECT s.value_fn AS fn, s.title, s.stat_id AS id, c.carrier
             FROM base_stat s JOIN base_collection c ON c.id = s.collection WHERE s.title IS NOT NULL
  LOOP
    SELECT pg_get_function_identity_arguments(p.oid) INTO sig FROM pg_proc p
     WHERE p.proname = r.fn AND p.pronargs > 0 AND p.proargtypes[0] = to_regtype(format('%I', r.carrier)) LIMIT 1;
    CONTINUE WHEN sig IS NULL;
    EXECUTE format('COMMENT ON FUNCTION %I(%s) IS %L', r.fn, sig, 'Statistic "' || r.title || '".'); n := n + 1;
  END LOOP;

  FOR r IN SELECT rp.render_fn AS fn, rp.title, rp.repr AS id, c.carrier
             FROM base_repr rp JOIN base_collection c ON c.id = rp.collection WHERE rp.title IS NOT NULL
  LOOP
    SELECT pg_get_function_identity_arguments(p.oid) INTO sig FROM pg_proc p
     WHERE p.proname = r.fn AND p.pronargs > 0 AND p.proargtypes[0] = to_regtype(format('%I', r.carrier)) LIMIT 1;
    CONTINUE WHEN sig IS NULL;
    EXECUTE format('COMMENT ON FUNCTION %I(%s) IS %L', r.fn, sig, 'Representation "' || r.title || '".'); n := n + 1;
  END LOOP;

  FOR r IN SELECT m.mapping_fn AS fn, m.title, m.map_id AS id, c.carrier
             FROM base_map m JOIN base_collection c ON c.id = m.collection WHERE m.title IS NOT NULL
  LOOP
    SELECT pg_get_function_identity_arguments(p.oid) INTO sig FROM pg_proc p
     WHERE p.proname = r.fn AND p.pronargs > 0 AND p.proargtypes[0] = to_regtype(format('%I', r.carrier)) LIMIT 1;
    CONTINUE WHEN sig IS NULL;
    EXECUTE format('COMMENT ON FUNCTION %I(%s) IS %L', r.fn, sig, 'Map "' || r.title || '".'); n := n + 1;
  END LOOP;

  RETURN n;
END $$;

-- register the per-collection COMMENT pass as a finalizer (#283 phase 1.3), not a load-time loop over
-- base_collection: this file loads once, as part of core — a pack's collections don't exist yet when it does, so a
-- loop here could never comment them. base_pack_finalize(pack) now runs base_comment_collection(coll) once per
-- collection owned by that pack, after the pack's own files (§3.5). Core's own call is wired at the tail of the
-- last core file in load order (meta-collections.stats.sql); the per-pack calls come from the loader, not yet built.
INSERT INTO base_finalizer (id, fn, description, scope) VALUES
  ('comment', 'base_comment_collection', 'COMMENT ON the generated per-collection surface (handle/element types, '
   'constructor, key handle-level functions), sourced from base_collection_meta.', 'collection');

-- base_comment_facets() is a BOUNDED whole-registry sweep over titled base_stat/base_repr/base_map rows (not
-- one-per-collection, and every row it reads is already core's — no pack besides core is ever loaded yet). It stays
-- a direct call here, unlike the loop above; see base_stat_derived.sql for the "genuinely not per-collection"
-- finalizer shape this would take if/when it needs to run per-pack.
SELECT base_comment_facets();

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('documentation','a realized collection''s handle type carries a comment sourced from its meta','eq','true','catalan_numbers handle type ~ its title',$q$
    SELECT (obj_description(to_regtype('catalan_numbers'), 'pg_type') LIKE 'Catalan Numbers%')::text $q$),
  ('documentation','a realized collection''s constructor carries a non-empty comment','eq','true','obj_description on catalan_numbers()',$q$
    SELECT (coalesce(obj_description(to_regprocedure('catalan_numbers()'), 'pg_proc'), '') <> '')::text $q$),
  ('documentation','cardinality(handle) is commented per-collection, not just once globally','eq','true','catalan_numbers vs set_partitions cardinality comments differ',$q$
    SELECT (obj_description(to_regprocedure('cardinality(catalan_numbers)'), 'pg_proc')
         <> obj_description(to_regprocedure('cardinality(set_partitions)'), 'pg_proc'))::text $q$),
  ('documentation','a collection with no base_collection_meta row is skipped, not guessed at','eq','0','base_comment_collection on an unknown id is a no-op',$q$
    SELECT base_comment_collection('__no_such_collection__')::text $q$),
  ('documentation','the generated surface now carries real pg_description rows (issue #147: was 0)','eq','true','handle/element type comments + constructor/handle-level function comments, summed',$q$
    SELECT ((
      (SELECT count(*) FROM pg_description d JOIN pg_type t ON t.oid = d.objoid AND d.classoid = 'pg_type'::regclass
         WHERE t.typname IN (SELECT id FROM base_collection) OR t.typname IN (SELECT id || '_element' FROM base_collection))
      +
      (SELECT count(*) FROM pg_description d JOIN pg_proc p ON p.oid = d.objoid AND d.classoid = 'pg_proc'::regclass
         WHERE p.proname IN (SELECT id FROM base_collection)
            OR p.proname IN ('cardinality','elements','unrank','fibers','random_element','carriers','unnest','contains','range'))
    ) > 1000)::text $q$),
  ('documentation','the COMMENT pass is a registered "collection"-scope finalizer, not a load-time loop','eq','true','#283 phase 1.3 — base_finalizer carries the comment row',$q$
    SELECT EXISTS (SELECT 1 FROM base_finalizer WHERE id = 'comment' AND fn = 'base_comment_collection'::regproc AND scope = 'collection')::text $q$),
  ('documentation','at least 90 realized collections carry a non-null handle-type comment (a floor, not a count)','eq','true','proves base_pack_finalize(''core'') actually ran the finalizer over core''s collections — the floor was 100 before the tableaux pack extracted ~13 collections out of core (#283 phase 3 lane 2)',$q$
    SELECT ((SELECT count(*) FROM base_collection c
              WHERE obj_description(to_regtype(c.id), 'pg_type') IS NOT NULL) > 90)::text $q$);
