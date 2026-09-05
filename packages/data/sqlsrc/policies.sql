-- requires: realizer, triangle_slices, tags, categories, catalog-resolution
-- requires-tag: collection
-- The POLICY layer (#243, epic #195): what a statement looks like before anyone edits it — the defaults of BOTH
-- halves (the SELECT list, the printers an environment may draw, the opening binding / GROUP BY / window / eager),
-- per collection, per environment, as registry rows. Postgres's own vocabulary, repurposed (policies.md §1):
-- GRANT SELECT (col, …) TO role = a column policy; ALTER DEFAULT PRIVILEGES = the default SELECT list per scope;
-- REVOKE = a restrictive row; CREATE POLICY … AS PERMISSIVE|RESTRICTIVE = how rows compose; pg_policies =
-- base_policy_resolved. Design + evaluation: docs/explorations/query-view/policies.md §6.
--
-- The model (settled by the spike's cases):
--   * a row applies by scope (collection ⊂ carrier ⊂ category/tag ⊂ all) × environment × ARCHETYPE — archetype is
--     a column like environment, not a scope: an element-rows select must not leak onto a grouped statement.
--   * resolution is ONE fold, general → specific: permissive APPENDS its columns (first spelling wins), override
--     REPLACES the accumulator, restrictive SUBTRACTS at the end (a restrictive row always wins — pg RESTRICTIVE).
--     Scalar clauses (binding, group_by, order_by, window, eager) ride the same fold: the last row wins.
--   * derived policies: a base_triangle row IS a policy (the triangle opens as its own table) — derived in
--     base_policy_all, never stored, like base_collection_tag's derived rows.
--   * templates the CLIENT expands: '<keys>' (the statement's GROUP BY keys) and '<axis> = 4' (the first grade
--     axis — the old DISPLAY_N_FALLBACK). 'eager' text is 'always' or a cardinality threshold.

-- the environments a statement renders into (the "roles"); '*' in a policy row means every one
CREATE TABLE base_environment (id text PRIMARY KEY, description text NOT NULL);
INSERT INTO base_environment VALUES
  ('web',      'the explorer and the docs site — inline SVG, links, KaTeX'),
  ('print',    'paged/static output — no links, no inline SVG (a link degrades to spelled text)'),
  ('terminal', 'the CLI — plain text only');

CREATE TABLE base_policy (
  scope_kind  text NOT NULL CHECK (scope_kind IN ('collection', 'carrier', 'category', 'tag', 'all')),
  scope       text NOT NULL,                 -- the id in that kind; '*' for scope_kind 'all'
  environment text NOT NULL DEFAULT '*',     -- a base_environment id, or '*'
  archetype   text NOT NULL DEFAULT '*'
              CHECK (archetype IN ('elements', 'fibers', 'distribution', 'rollup', 'rowgroup', '*')),
  clause      text NOT NULL CHECK (clause IN
              ('select', 'printer', 'binding', 'where', 'group_by', 'having', 'order_by', 'window', 'eager')),
  mode        text NOT NULL DEFAULT 'permissive' CHECK (mode IN ('permissive', 'restrictive', 'override')),
  text        text NOT NULL,                 -- the clause's text, exactly as the URL / RowQuery carries it
  priority    int  NOT NULL DEFAULT 0,       -- orders rows tied on specificity; higher = later in the fold (wins)
  note        text,
  PRIMARY KEY (scope_kind, scope, environment, archetype, clause, mode, text)
);

-- how specific a scope kind is (0 = most specific); category and tag tie — priority breaks
CREATE FUNCTION policy_tier(kind text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE kind WHEN 'collection' THEN 0 WHEN 'carrier' THEN 1 WHEN 'category' THEN 2 WHEN 'tag' THEN 2 ELSE 3 END $$;

-- stored rows ∪ policies DERIVED from other registries: a triangle opens as its own table — but ONLY when its
-- fiber_count is accelerated: counting by enumeration on the default page wedges the shared worker (#254), so a
-- triangle without the accel (gelfand_tsetlin) keeps opening as elements until one lands.
CREATE VIEW base_policy_all AS
  SELECT scope_kind, scope, environment, archetype, clause, mode, text, priority, note FROM base_policy
  UNION ALL
  SELECT 'collection', collection, '*', '*', 'group_by', 'override', row_axis || ', ' || col_axis, 0,
         'derived: base_triangle' FROM base_triangle
   WHERE to_regprocedure(format('fiber_count(%I)', collection || '_fiber')) IS NOT NULL
  UNION ALL
  SELECT 'collection', collection, '*', 'fibers', 'select', 'override',
         row_axis || ', ' || col_axis || ', count'
           || CASE WHEN to_regprocedure(format('fiber_symbol(%I)', collection || '_fiber')) IS NOT NULL
                   THEN ', symbol' ELSE '' END,
         0, 'derived: base_triangle' FROM base_triangle
   WHERE to_regprocedure(format('fiber_count(%I)', collection || '_fiber')) IS NOT NULL;

-- the rows that apply to (coll, env, arch, clause), ordered GENERAL → SPECIFIC for the fold
CREATE FUNCTION policy_rows(coll text, env text, arch text, cl text)
RETURNS TABLE (mode text, text text) LANGUAGE sql STABLE AS $$
  SELECT p.mode, p.text
    FROM base_policy_all p
   WHERE p.clause = cl
     AND (p.environment = '*' OR p.environment = env)
     AND (p.archetype = '*' OR p.archetype = arch)
     AND CASE p.scope_kind
           WHEN 'all'        THEN true
           WHEN 'collection' THEN p.scope = coll
           WHEN 'carrier'    THEN p.scope = (SELECT carrier FROM base_collection WHERE id = coll)
           WHEN 'category'   THEN EXISTS (SELECT 1 FROM base_collection_category c
                                           WHERE c.collection = coll AND c.category = p.scope)
           WHEN 'tag'        THEN EXISTS (SELECT 1 FROM base_collection_tag t
                                           WHERE t.collection = coll AND t.tag = p.scope)
         END
   ORDER BY policy_tier(p.scope_kind) DESC, (p.environment <> '*') ASC, (p.archetype <> '*') ASC, p.priority ASC $$;

-- policy_resolve: the clause's default text for (collection, environment[, archetype]), or NULL when no policy.
--   select        — the fold: permissive appends (first spelling wins), override replaces, restrictive subtracts
--   where/having  — permissive rows OR together, restrictive rows AND on: (p1 OR p2) AND (r1) AND (r2)
--   the rest      — the most specific row's text verbatim (mode is irrelevant; write them as override)
-- 'printer' does not resolve here — see policy_printers (it is keyed by column KIND, not by collection).
CREATE FUNCTION policy_resolve(coll text, env text, cl text, arch text DEFAULT 'elements')
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE r record; acc text[] := '{}'; restr text[] := '{}'; perms text[] := '{}'; scalar text; t text;
BEGIN
  IF cl = 'printer' THEN RAISE EXCEPTION 'printer resolves per column kind — use policy_printers(kind, environment)'; END IF;
  FOR r IN SELECT * FROM policy_rows(coll, env, arch, cl) LOOP
    IF cl = 'select' THEN
      IF r.mode = 'restrictive' THEN
        restr := restr || (SELECT array_agg(btrim(x)) FROM unnest(string_to_array(r.text, ',')) x);
      ELSIF r.mode = 'override' THEN
        acc := '{}';
        FOREACH t IN ARRAY string_to_array(r.text, ',') LOOP
          IF NOT btrim(t) = ANY (acc) THEN acc := acc || btrim(t); END IF;
        END LOOP;
      ELSE
        FOREACH t IN ARRAY string_to_array(r.text, ',') LOOP
          IF NOT btrim(t) = ANY (acc) THEN acc := acc || btrim(t); END IF;
        END LOOP;
      END IF;
    ELSIF cl IN ('where', 'having') THEN
      IF r.mode = 'restrictive' THEN restr := restr || r.text; ELSE perms := perms || r.text; END IF;
    ELSE
      scalar := r.text;   -- last row = most specific wins
    END IF;
  END LOOP;
  IF cl = 'select' THEN
    acc := (SELECT coalesce(array_agg(x ORDER BY ord), '{}') FROM unnest(acc) WITH ORDINALITY AS u(x, ord)
             WHERE NOT x = ANY (restr));
    RETURN CASE WHEN acc = '{}' THEN NULL ELSE array_to_string(acc, ', ') END;
  ELSIF cl IN ('where', 'having') THEN
    -- (p1 OR p2 ...) AND (r1) AND (r2): every part parenthesized so operator precedence can never regroup it
    IF perms <> '{}' THEN
      restr := ARRAY['(' || (SELECT array_to_string(array_agg('(' || x || ')'), ' OR ') FROM unnest(perms) x) || ')'] || restr;
    END IF;
    RETURN nullif(array_to_string((SELECT array_agg(CASE WHEN x LIKE '(%' THEN x ELSE '(' || x || ')' END)
                                     FROM unnest(restr) x), ' AND '), '');
  END IF;
  RETURN scalar;
END $$;

-- policy_printers(kind, environment): the printers the environment is granted for a column of this kind, in
-- preference order (the first is the default). Permissive rows spell '<kind>: <p1>, <p2>' (today's BY_KIND);
-- restrictive rows revoke bare printers for their environment (today's GRANTS, inverted). Never empty — plain.
CREATE FUNCTION policy_printers(kind text, env text) RETURNS text[] LANGUAGE sql STABLE AS $$
  WITH pref AS (
    SELECT text FROM base_policy_all
     WHERE clause = 'printer' AND mode = 'permissive' AND scope_kind = 'all'
       AND (environment = '*' OR environment = env)
       AND btrim(split_part(text, ':', 1)) = kind
     ORDER BY (environment <> '*') DESC, priority DESC LIMIT 1),
  prefs AS (
    SELECT btrim(x) AS p, ord
      FROM pref, unnest(string_to_array(split_part(pref.text, ':', 2), ',')) WITH ORDINALITY AS u(x, ord)),
  revoked AS (
    SELECT btrim(x) AS p FROM base_policy_all, unnest(string_to_array(text, ',')) x
     WHERE clause = 'printer' AND mode = 'restrictive' AND scope_kind = 'all' AND environment = env),
  kept AS (SELECT p, ord FROM prefs WHERE p NOT IN (SELECT p FROM revoked))
  SELECT CASE WHEN count(*) = 0 THEN ARRAY['plain'] ELSE array_agg(p ORDER BY ord) END FROM kept $$;

-- policy_select_errors: the tokens of a resolved select list the collection cannot project — a policy may not name
-- a column the collection lacks. '<keys>' (the grouped-archetype template the client expands) always passes.
CREATE FUNCTION policy_select_errors(coll text, sel text) RETURNS SETOF text LANGUAGE plpgsql STABLE AS $$
DECLARE t text; tok text; pre text; rest text; ok boolean; crr text;
BEGIN
  SELECT carrier INTO crr FROM base_collection WHERE id = coll;
  FOREACH t IN ARRAY string_to_array(coalesce(sel, ''), ',') LOOP
    tok := btrim(t);
    CONTINUE WHEN tok = '' OR tok = '<keys>';
    pre := split_part(tok, ':', 1); rest := btrim(substr(tok, length(pre) + 2));
    ok := CASE
      WHEN tok IN ('ordinality', 'rank', 'address', 'omega', 'element', 'count', 'level', 'data') THEN true
      WHEN tok = 'glyph'  THEN carrier_renders_svg(crr)
      WHEN tok = 'symbol' THEN to_regprocedure(format('fiber_symbol(%I)', coll || '_fiber')) IS NOT NULL
      WHEN pre = 'repr'   THEN EXISTS (SELECT 1 FROM base_repr_resolved r
                                        WHERE r.collection = coll AND r.repr = split_part(rest, '@', 1))
      WHEN pre = 'map'    THEN EXISTS (SELECT 1 FROM base_map_resolved m WHERE m.collection = coll AND m.map_id = rest)
      WHEN pre IN ('dist', 'pivot', 'min', 'max', 'sum', 'avg')
                          THEN EXISTS (SELECT 1 FROM base_stat_resolved s WHERE s.collection = coll AND s.stat_id = rest)
      WHEN pre = 'over'   THEN rest IN ('count', 'symbol')
                            OR (split_part(rest, ':', 1) IN ('min', 'max', 'sum', 'avg') AND EXISTS
                                (SELECT 1 FROM base_stat_resolved s WHERE s.collection = coll
                                  AND s.stat_id = btrim(substr(rest, length(split_part(rest, ':', 1)) + 2))))
      ELSE EXISTS (SELECT 1 FROM base_grade g WHERE g.collection = coll AND g.name = tok)
        OR EXISTS (SELECT 1 FROM base_stat_resolved s WHERE s.collection = coll AND s.stat_id = tok)
    END;
    IF NOT ok THEN RETURN NEXT tok; END IF;
  END LOOP;
END $$;

-- base_policy_resolved: the OPENING statement per (collection, environment) — pg_policies / \dp for this layer.
-- The archetype is derived from the resolved group_by (a stat key ⇒ distribution, axis keys ⇒ fibers, none ⇒
-- elements); select / window resolve under it. order_by NULL = canonical (axes…, rank); binding may carry the
-- '<axis>' template (the client substitutes the first axis).
-- column names dodge reserved keywords (#241's guard): select_list / where_clause / having_clause / window_size
CREATE VIEW base_policy_resolved AS
  SELECT c.id AS collection, e.id AS environment, a.archetype,
         policy_resolve(c.id, e.id, 'select', a.archetype)  AS select_list,
         policy_resolve(c.id, e.id, 'binding')              AS binding,
         gb.gb                                              AS group_by,
         policy_resolve(c.id, e.id, 'where')                AS where_clause,
         policy_resolve(c.id, e.id, 'having')               AS having_clause,
         policy_resolve(c.id, e.id, 'order_by', a.archetype) AS order_by,
         policy_resolve(c.id, e.id, 'window', a.archetype)  AS window_size,
         policy_resolve(c.id, e.id, 'eager', a.archetype)   AS eager
    FROM base_collection c
    CROSS JOIN base_environment e
    CROSS JOIN LATERAL (SELECT policy_resolve(c.id, e.id, 'group_by') AS gb) gb
    CROSS JOIN LATERAL (SELECT CASE
      WHEN gb.gb IS NULL THEN 'elements'
      WHEN EXISTS (SELECT 1 FROM unnest(string_to_array(gb.gb, ',')) k
                    JOIN base_stat_resolved s ON s.collection = c.id AND s.stat_id = btrim(k)) THEN 'distribution'
      ELSE 'fibers' END AS archetype) a
   WHERE c.alias_of IS NULL;

-- ── seeds — today's constants (seedRows, GRANTS × BY_KIND, EAGER_ALL, DISPLAY_N_FALLBACK) as rows ────────────────
INSERT INTO base_policy (scope_kind, scope, environment, archetype, clause, mode, text, note) VALUES
  -- the SELECT list, per archetype (ALTER DEFAULT PRIVILEGES)
  ('all', '*', '*', 'elements',     'select', 'permissive', 'ordinality, address, element', 'the element-rows base'),
  ('all', '*', '*', 'fibers',       'select', 'permissive', '<keys>, count',        'client expands <keys>'),
  ('all', '*', '*', 'distribution', 'select', 'permissive', '<keys>, count',        'client expands <keys>'),
  ('all', '*', '*', 'rollup',       'select', 'permissive', '<keys>, count, level', 'client expands <keys>'),
  ('all', '*', '*', 'rowgroup',     'select', 'permissive', '<keys>, count, ordinality, address, element', 'keys + the element base'),
  -- the meta tables: nominal, named, eager
  ('category', 'internal', '*', 'elements', 'select', 'override', 'element, title', 'registries are named rows'),
  ('category', 'internal', '*', '*',        'eager',  'override', 'always',         'nominal and precomputed'),
  ('collection', 'collections', '*', 'elements', 'select', 'override', 'element, title, carrier, tags', NULL),
  ('collection', 'carriers', '*', 'elements', 'select', 'override', 'element, collections', 'no title stat (yet)'),
  ('collection', 'glyphs',   '*', 'elements', 'select', 'override', 'element', 'no stats registered'),
  -- carriers
  ('carrier', 'numeric', '*', 'elements', 'select', 'override', 'ordinality, element, repr:binary', NULL),
  ('carrier', 'numeric', '*', '*',        'window', 'override', '100', NULL),
  ('carrier', 'permutation', '*', 'elements', 'select', 'permissive',
   'ordinality, address, element, descents, inversions, cycles', 'restates the base to keep positions first'),
  ('carrier', 'permutation', '*', '*', 'binding', 'override', 'size = 4', NULL),
  ('carrier', 'permutation', 'terminal', 'elements', 'select', 'override', 'element, descents, inversions',
   'the CLI default — no positions'),
  ('carrier', 'dyck_path', '*', '*', 'binding', 'override', 'n = 4', NULL),
  ('collection', 'integer_partitions', '*', 'elements', 'select', 'permissive', 'repr:ferrers', 'appends to the base'),
  -- the opening binding fallback (DISPLAY_N_FALLBACK): the client substitutes the first axis
  ('all', '*', '*', '*', 'binding', 'override', '<axis> = 4', 'side panels need SOME size; never reaches the handle'),
  -- eager vs streamed (EAGER_ALL) and the window
  ('all', '*', '*', '*',            'eager',  'override', '2000', 'eager when cardinality <= this'),
  ('all', '*', '*', '*',            'window', 'override', '100',  'streamed element rows per fetch'),
  ('all', '*', '*', 'fibers',       'window', 'override', '200',  'fiber rows per fetch'),
  ('all', '*', '*', 'distribution', 'window', 'override', '200', NULL),
  ('all', '*', '*', 'rollup',       'window', 'override', '200', NULL);

-- printers: BY_KIND as permissive '<kind>: <prefs>' rows; GRANTS as per-environment revocations
INSERT INTO base_policy (scope_kind, scope, environment, clause, mode, text) VALUES
  ('all', '*', '*', 'printer', 'permissive', 'ordinality: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'rank: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'address: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'omega: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'level: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'axis: plain, grouped'),
  ('all', '*', '*', 'printer', 'permissive', 'element: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'repr: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'stat: plain, grouped'),
  ('all', '*', '*', 'printer', 'permissive', 'map: link, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'through: link, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'glyph: svg, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'data: plain'),
  ('all', '*', '*', 'printer', 'permissive', 'title: link, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'count: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'agg: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'dist: bars, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'pivot: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'over: grouped, plain'),
  ('all', '*', '*', 'printer', 'permissive', 'symbol: plain'),
  ('all', '*', 'print',    'printer', 'restrictive', 'svg, link'),
  ('all', '*', 'terminal', 'printer', 'restrictive', 'katex, link, svg, bars');

-- ── the P8 gate: enumerate ⇔ contains over every base_restrict row ────────────────────────────────────────────────
-- USING vs WITH CHECK (policies.md §1): the child's enumeration must agree with its predicate — every enumerated
-- element satisfies it, and every parent element satisfying it is enumerated, in the parent's order. Compares the
-- child's first `n` elements (the accelerated path, engines and hooks wired) against the parent's floor filtered by
-- the predicate — cut to a common length so open/sparse parents stay bounded (scan capped at `scan` elements).
CREATE FUNCTION restrict_agrees(coll text, n int DEFAULT 24, scan int DEFAULT 3000)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE par text; pred text; child text[]; filtered text[]; len int;
BEGIN
  SELECT parent, predicate INTO par, pred FROM base_collection_parent WHERE collection = coll;
  IF par IS NULL THEN RETURN NULL; END IF;
  EXECUTE format('SELECT array_agg(render(e)) FROM (SELECT e FROM elements(%I(), %s) e LIMIT %s) t',
                 coll, n, n) INTO child;
  EXECUTE format('SELECT array_agg(r) FROM (SELECT render(e) AS r FROM elements(%I(), %s) e WHERE %I((e).value) LIMIT %s) t',
                 par, scan, pred, n) INTO filtered;
  len := least(coalesce(array_length(child, 1), 0), coalesce(array_length(filtered, 1), 0));
  IF len = 0 THEN RETURN false; END IF;   -- nothing comparable is a failure, not a pass
  RETURN child[1:len] = filtered[1:len];
END $$;

-- print hides the heavyweight element columns (§1's REVOKE): no default list carries them, but a URL might
INSERT INTO base_policy (scope_kind, scope, environment, archetype, clause, mode, text, note) VALUES
  ('all', '*', 'print', '*', 'select', 'restrictive', 'glyph, data', 'hide the SVG and the JSON cast in print');

-- ── examples: policies.md §4's cases 1–5 and 7, as living assertions ──────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('policies', 'case 1: the fold — the permutation carrier''s list over the base, positions first', 'eq', 'true',
   'permissive rows append general → specific; the carrier row restates the base to keep positions first', $q$
    SELECT (starts_with(s, 'ordinality, address, element')
            AND s LIKE '%descents%' AND s LIKE '%inversions%' AND s LIKE '%cycles%')::text
      FROM policy_resolve('permutations', 'web', 'select') s $q$),
  ('policies', 'case 1b: no policy names a column its collection lacks (every collection × environment)', 'eq', '0',
   'policy_select_errors over every resolved statement — the seed-typo gate', $q$
    SELECT count(*)::text FROM base_policy_resolved, LATERAL policy_select_errors(collection, select_list) $q$),
  ('policies', 'case 2: the collections meta-table opens named and eager', 'eq', 'true',
   'element, title, carrier, tags — and no positions; category internal is eager', $q$
    SELECT (s LIKE '%title%' AND s LIKE '%carrier%' AND s LIKE '%tags%' AND s NOT LIKE '%ordinality%'
            AND policy_resolve('collections', 'web', 'eager') = 'always')::text
      FROM policy_resolve('collections', 'web', 'select') s $q$),
  ('policies', 'case 3: a triangle opens as its own table (derived policy)', 'eq', 'true',
   'base_triangle rows derive group_by + a fibers select — k_subsets opens grouped', $q$
    SELECT (r.group_by IS NOT NULL AND r.archetype = 'fibers' AND r.select_list LIKE '%count%')::text
      FROM base_policy_resolved r WHERE r.collection = 'k_subsets' AND r.environment = 'web' $q$),
  ('policies', 'case 4: printers per environment — print revokes svg and link, terminal is text-only', 'eq', 'true',
   'GRANTS × BY_KIND as rows; a revocation never empties a grant below {plain}', $q$
    SELECT ((policy_printers('glyph', 'web'))[1] = 'svg'
            AND policy_printers('glyph', 'print') = ARRAY['plain']
            AND policy_printers('map', 'terminal') = ARRAY['plain']
            AND policy_printers('dist', 'terminal') = ARRAY['plain'])::text $q$),
  ('policies', 'case 5: a restrictive row beats a permissive AND an override re-add', 'ok', NULL,
   'pg RESTRICTIVE: subtraction is unconditional; the probe rows clean up after themselves', $q$
    DO $do$ BEGIN
      INSERT INTO base_policy (scope_kind, scope, environment, archetype, clause, mode, text, note) VALUES
        ('all', '*', '*', 'elements', 'select', 'restrictive', 'omega', 'case-5 probe'),
        ('collection', 'permutations', '*', 'elements', 'select', 'permissive', 'omega', 'case-5 probe'),
        ('collection', 'dyck_paths', '*', 'elements', 'select', 'override', 'element, omega', 'case-5 probe');
      IF position('omega' in policy_resolve('permutations', 'web', 'select')) > 0
         OR position('omega' in policy_resolve('dyck_paths', 'web', 'select')) > 0 THEN
        RAISE EXCEPTION 'a restrictive row did not win';
      END IF;
      DELETE FROM base_policy WHERE note = 'case-5 probe';
    END $do$ $q$),
  ('policies', 'case 7: every restriction''s enumeration agrees with its predicate (n = 12)', 'eq', 'true',
   'USING ⇔ WITH CHECK: the accelerated child stream = the parent''s floor filtered, in order', $q$
    SELECT coalesce(bool_and(restrict_agrees(collection, 12, 2000)), false)::text FROM base_collection_parent $q$),
  ('policies', 'case 8: the CLI''s default columns are the terminal policy', 'eq', 'true',
   'compact, no positions — the environment override at the carrier scope', $q$
    SELECT (s LIKE '%element%' AND s LIKE '%descents%' AND s NOT LIKE '%ordinality%' AND s NOT LIKE '%address%')::text
      FROM policy_resolve('permutations', 'terminal', 'select') s $q$),
  ('policies', 'every policy scope names a real collection / carrier / category / tag', 'eq', '0',
   'a typo''d scope would silently apply to nothing', $q$
    SELECT count(*)::text FROM base_policy p
     WHERE CASE p.scope_kind
             WHEN 'collection' THEN NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.id = p.scope)
             WHEN 'carrier'    THEN NOT EXISTS (SELECT 1 FROM base_collection c WHERE c.carrier = p.scope)
             WHEN 'category'   THEN NOT EXISTS (SELECT 1 FROM base_category c WHERE c.id = p.scope)
             WHEN 'tag'        THEN NOT EXISTS (SELECT 1 FROM base_tag t WHERE t.id = p.scope)
             ELSE p.scope <> '*' END $q$),
  ('policies', 'every policy environment is registered (or ''*'')', 'eq', '0', 'no orphan environments', $q$
    SELECT count(*)::text FROM base_policy p
     WHERE p.environment <> '*' AND NOT EXISTS (SELECT 1 FROM base_environment e WHERE e.id = p.environment) $q$),
  ('policies', 'the resolved sweep is total: a statement per collection × environment, none unseeded', 'eq', 'true',
   'floors, not exact counts: every live collection resolves a select and a binding in every environment', $q$
    SELECT (count(*) >= (SELECT count(*) FROM base_collection WHERE alias_of IS NULL) * 3
            AND count(*) FILTER (WHERE select_list IS NULL) = 0
            AND count(*) FILTER (WHERE binding IS NULL) = 0)::text
      FROM base_policy_resolved $q$);

-- the where/having fold composes with explicit parens: (p1 OR p2) AND (r) — precedence can never regroup it
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('policies', 'where rows compose as (p1 OR p2) AND (r)', 'ok', NULL,
   'permissive rows OR together inside parens; every restrictive row ANDs on, parenthesized', $q$
    DO $do$ DECLARE got text; BEGIN
      INSERT INTO base_policy (scope_kind, scope, environment, archetype, clause, mode, text, note) VALUES
        ('collection', 'permutations', '*', '*', 'where', 'permissive',  'descents = 1', 'paren probe'),
        ('collection', 'permutations', '*', '*', 'where', 'permissive',  'cycles = 2',   'paren probe'),
        ('collection', 'permutations', '*', '*', 'where', 'restrictive', 'inversions < 9', 'paren probe');
      got := policy_resolve('permutations', 'web', 'where');
      -- specificity ties leave the OR order unspecified — assert the composition, not the ordering
      IF got NOT IN ('((descents = 1) OR (cycles = 2)) AND (inversions < 9)',
                     '((cycles = 2) OR (descents = 1)) AND (inversions < 9)') THEN
        RAISE EXCEPTION 'where fold mis-composed: %', got;
      END IF;
      DELETE FROM base_policy WHERE note = 'paren probe';
    END $do$ $q$),
  ('policies', 'a triangle without an accelerated fiber_count derives NO opening policy (#254)', 'eq', '0',
   'counting by enumeration cannot be a default page — gelfand_tsetlin opens as elements until its accel lands', $q$
    SELECT count(*)::text FROM base_policy_all p
     WHERE p.note = 'derived: base_triangle'
       AND to_regprocedure(format('fiber_count(%I)', p.scope || '_fiber')) IS NULL $q$);
