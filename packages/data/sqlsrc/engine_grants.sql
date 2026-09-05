-- requires: policies, function_impls
-- base_engine / base_engine_grant: which COMPUTE ENGINE gets to touch which SELECT-list columns, per scope
-- (#278 increment 2b — the async-calc engine model, wiki/Async-Calc-Engines). policies.sql answers "what does a
-- statement's SELECT list default to"; this answers a narrower, engine-facing question layered on top of it:
-- "may THIS engine (pg / ts / wasm) even compute a column of THIS kind, for THIS collection". pg is the oracle —
-- granted everywhere, unconditionally — because every column kind is defined by what pg's realizer.sql already
-- computes; a non-pg engine only earns a grant where a real alternate implementation exists to back it (today:
-- packages/math's scalar Apply surface only — see the scalar_math basket below).
--
-- base_column_group baskets the 20 SelectKind values (packages/client/src/select.ts:50-52) plus one pseudo-kind,
-- 'apply' (the FROM-less scalar Apply over a base_function — not a SelectKind at all, since it has no row/fiber
-- level to project from; it's grouped here because it's the one thing a non-pg engine can actually compute today).
CREATE TABLE base_engine (id text PRIMARY KEY, description text NOT NULL);
CREATE TABLE base_column_group (id text PRIMARY KEY, kinds text[] NOT NULL, description text NOT NULL);
CREATE TABLE base_engine_grant (
  engine       text NOT NULL REFERENCES base_engine,
  column_group text NOT NULL REFERENCES base_column_group,
  scope_kind   text NOT NULL CHECK (scope_kind IN ('collection','carrier','category','tag','all')),
  scope        text NOT NULL,
  mode         text NOT NULL DEFAULT 'permissive' CHECK (mode IN ('permissive','restrictive')),
  note         text,
  PRIMARY KEY (engine, column_group, scope_kind, scope, mode)
);

INSERT INTO base_engine (id, description) VALUES
  ('pg',   'the pure-SQL core over pglite — the oracle engine every collection is defined against'),
  ('ts',   '@enumeratio/math — a pure-TS, zero-dep mirror of pg''s scalar math (packages/math)'),
  ('wasm', 'a future WebAssembly engine — no implementation yet, registered so the grant model doesn''t special-case it');

-- the deferred FK: base_function_impl.engine names an engine role, but base_engine didn't exist yet when
-- function_impls.sql loaded (it loads before this file in the toposort — `requires: policies, function_impls`
-- above). Adding it here, now that both tables exist AND base_engine is seeded, closes the loop without an
-- artificial load-order inversion (the ALTER validates existing rows immediately — it must come after the seed).
ALTER TABLE base_function_impl ADD CONSTRAINT base_function_impl_engine_fkey
  FOREIGN KEY (engine) REFERENCES base_engine;

INSERT INTO base_column_group (id, kinds, description) VALUES
  ('positions',   '{ordinality,rank,address,omega}', 'the element''s own position(s) in the enumeration'),
  ('renders',     '{element,repr,title}',            'the canonical or an alternate rendering of the element'),
  ('glyphs',      '{glyph,data}',                     'the SVG and the carrier-as-JSON columns'),
  ('maps',        '{map,through}',                    'a map image, bare or composed through a chain'),
  ('stats',       '{stat,axis}',                      'a bare id: a grade axis or a registered statistic'),
  ('aggregates',  '{count,agg,dist,pivot,symbol,level,over}', 'fiber-level columns and the element-level lift of one (over)'),
  ('scalar_math', '{apply}',
   'the FROM-less Apply surface over a base_function — a pseudo-kind, not a SelectKind: it has no row/fiber level '
   'to project from, only arguments and a result');

-- pg: every basket, unconditionally — the oracle. ts: scalar_math only, and ONLY at 'all' — packages/math has no
-- enumerator or render twin for anything else yet (renders/glyphs/positions/maps/stats/aggregates all read the
-- pg-computed element stream). Widen this only as real ts enumerator/render implementations land, not in advance
-- of them: an ungranted basket here is a true "not yet available", not an oversight.
INSERT INTO base_engine_grant (engine, column_group, scope_kind, scope, note) VALUES
  ('pg', 'positions',   'all', '*', NULL),
  ('pg', 'renders',     'all', '*', NULL),
  ('pg', 'glyphs',      'all', '*', NULL),
  ('pg', 'maps',        'all', '*', NULL),
  ('pg', 'stats',       'all', '*', NULL),
  ('pg', 'aggregates',  'all', '*', NULL),
  ('pg', 'scalar_math', 'all', '*', NULL),
  ('ts', 'scalar_math', 'all', '*', 'the only basket packages/math backs today — keep it here until an '
   'enumerator/render twin exists for something else');

-- engine_grants(engine, coll): the granted basket ids for that engine at that collection's resolved scope.
-- Same fold as policy_rows (policies.sql) — rows ordered general → specific by policy_tier(scope_kind);
-- permissive rows APPEND (union, first spelling wins), restrictive rows SUBTRACT at the end and always win.
-- base_engine_grant has no 'override' mode (unlike base_policy) — there's nothing to replace, only grant/revoke —
-- so the fold is simpler than policy_resolve's 'select' case, but the ordering and policy_tier reuse are the same.
CREATE FUNCTION engine_grants(eng text, coll text) RETURNS text[] LANGUAGE plpgsql STABLE AS $$
DECLARE r record; acc text[] := '{}'; restr text[] := '{}';
BEGIN
  FOR r IN
    SELECT g.column_group, g.mode
      FROM base_engine_grant g
     WHERE g.engine = eng
       AND CASE g.scope_kind
             WHEN 'all'        THEN true
             WHEN 'collection' THEN g.scope = coll
             WHEN 'carrier'    THEN g.scope = (SELECT carrier FROM base_collection WHERE id = coll)
             WHEN 'category'   THEN EXISTS (SELECT 1 FROM base_collection_category c
                                             WHERE c.collection = coll AND c.category = g.scope)
             WHEN 'tag'        THEN EXISTS (SELECT 1 FROM base_collection_tag t
                                             WHERE t.collection = coll AND t.tag = g.scope)
           END
     ORDER BY policy_tier(g.scope_kind) DESC
  LOOP
    IF r.mode = 'restrictive' THEN
      restr := restr || r.column_group;
    ELSIF NOT r.column_group = ANY(acc) THEN
      acc := acc || r.column_group;
    END IF;
  END LOOP;
  RETURN (SELECT coalesce(array_agg(x ORDER BY x), '{}') FROM unnest(acc) x WHERE NOT x = ANY(restr));
END $$;

-- base_stat_foldable: (collection, stat, engine) rows where a WHERE-clause predicate on that stat is
-- push-down-able for that engine, i.e. the engine can evaluate the stat itself rather than needing pg's element
-- stream filtered after the fact. pg is foldable for every (collection, stat) pair — it's the stat's own
-- definition. A non-pg engine is foldable only where a REAL alternate implementation of that exact value_fn
-- exists: base_stat.value_fn is a pg proname; if that proname is some base_function's pg impl_ref, and the same
-- base_function also has an impl row on the other engine, the other engine can compute the identical value.
--
-- Deliberately NOT joined here: base_triangle and base_generating_function. Both look like they should widen
-- non-pg foldability (a triangle's fiber_count, a generating function's closed-form distribution), but neither
-- has a non-pg implementation today — base_triangle's derived opening policy requires an ACCELERATED
-- fiber_count(<fiber>), and every gf_* builder in generating_functions.sql is a plpgsql function with no ts/wasm
-- twin. Joining them in now would claim foldability nothing actually backs. When either grows a non-pg impl,
-- this view is where that join belongs.
CREATE VIEW base_stat_foldable AS
  SELECT s.collection, s.stat_id, e.id AS engine
    FROM base_stat_resolved s
    CROSS JOIN base_engine e
   WHERE e.id = 'pg'
  UNION
  SELECT s.collection, s.stat_id, i2.engine
    FROM base_stat_resolved s
    JOIN base_function_impl i1 ON i1.engine = 'pg' AND i1.impl_ref = s.value_fn
    JOIN base_function_impl i2 ON i2.function = i1.function AND i2.engine <> 'pg';

-- floors only (registry self-test convention: assert containment, never exact counts).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('engine_grants', 'every base_function has at least one impl row (re-asserted at this layer''s load point)',
   'eq', '0', 'engine_grants/base_stat_foldable both lean on base_function_impl being total — cheap to reassert '
   'here rather than trust load order alone', $q$
     SELECT count(*)::text FROM base_function f
      WHERE NOT EXISTS (SELECT 1 FROM base_function_impl i WHERE i.function = f.id) $q$),
  ('engine_grants', 'every engine named by a base_function_impl or base_engine_grant row is registered', 'eq', '0',
   'no orphan engine ids — a typo''d engine would silently grant/back nothing', $q$
     SELECT count(*)::text FROM (
       SELECT engine FROM base_function_impl WHERE engine NOT IN (SELECT id FROM base_engine)
       UNION ALL
       SELECT engine FROM base_engine_grant WHERE engine NOT IN (SELECT id FROM base_engine)
     ) t $q$),
  ('engine_grants', 'every one of the 20 SelectKind values sits in exactly one base_column_group', 'eq', 'true',
   'select.ts:50-52''s SelectKind union, spelled literally — one home each, no gaps, no double-basketing', $q$
     WITH kinds AS (
       SELECT unnest(ARRAY['ordinality','rank','address','omega','axis','element','repr','stat','map','through',
                            'glyph','data','title','count','agg','dist','pivot','symbol','level','over']) AS kind
     ), homes AS (
       SELECT k.kind, count(*) AS n FROM kinds k
         JOIN base_column_group g ON k.kind = ANY (g.kinds)
        GROUP BY k.kind
     )
     SELECT ((SELECT count(*) FROM kinds) = (SELECT count(*) FROM homes) AND bool_and(n = 1))::text FROM homes $q$);
