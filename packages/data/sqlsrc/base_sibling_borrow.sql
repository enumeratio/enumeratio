-- requires: realizer
-- base_sibling_borrow (#401 slice 1) — EXPLICIT OPT-IN sibling stat/map borrowing. A "family" is a set of sibling
-- collections over the same underlying object, connected pairwise by an order-iso/bijective base_map (e.g.
-- lehmer_codes <-> permutations, #402). Rather than re-deriving a stat/map on every sibling by hand, or (the
-- rejected alternative) auto-inheriting EVERYTHING across every bijection — see the design fork in issue #401 —
-- a sibling opts in per row: "collection X borrows Y's stat/map `id`, transported across the `via_map` bijection
-- X already owns." No namespace explosion, no silent auto-borrow.
--
-- Why codegen, not query-time resolution: pg has NO generic composites (the poset-Möbius finding, sqlsrc/
-- poset_mobius.sql) — a resolver can't be parameterized over an arbitrary carrier at runtime. So, like the
-- realizer itself and base_stat_derived's composition pass, the finalizer below GENERATES one concrete SQL
-- function per borrow row (composing the canonical's stat/map through the transporting map), at PACK finalize
-- time. TS is unconstrained (no generic-composite limit) — the ts-engine transport composes the bijection
-- generically at runtime instead of via codegen (packages/client).
--
-- Columns: `collection` is the sibling doing the borrowing; `kind` is 'stat' or 'map'; `id` is the stat_id/map_id
-- to borrow — REUSED verbatim as the sibling's own stat_id/map_id (so a page can show "inversions" on both
-- permutations and lehmer_codes under the same name); `from_collection` is the canonical collection the value
-- comes from; `via_map` names a base_map row ALREADY REGISTERED ON `collection` (map_id, not the function name)
-- whose codomain must be `from_collection` — that's the bijection the value transports across.
CREATE TABLE base_sibling_borrow (
  collection      text NOT NULL REFERENCES base_collection,
  kind            text NOT NULL CHECK (kind IN ('stat', 'map')),
  id              text NOT NULL,
  from_collection text NOT NULL REFERENCES base_collection,
  via_map         text NOT NULL,
  pack            text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack,
  PRIMARY KEY (collection, kind, id)
);
CREATE TRIGGER base_sibling_borrow_pack_guard BEFORE UPDATE OR DELETE ON base_sibling_borrow FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- base_realize_sibling_borrow(pack): the codegen finalizer (mirrors base_stat_derived's shape — see
-- base_stat_derived.sql). 'pack'-scope (#283 phase 1.3): this sweeps its OWN small curated registry, filtered by
-- the row's own `pack` column (not base_collection.pack — a borrow row's sibling and canonical collections can sit
-- in different packs, e.g. a sibling pack borrowing from core). For each row:
--   1. resolve `via_map` on `collection` (base_map) — must exist and must land in `from_collection`.
--   2. resolve `id` on `from_collection` (base_stat or base_map, by `kind`).
--   3. emit one function e(<sibling carrier>) = <canonical fn>(<via_map fn>(e)), and register it as the
--      sibling's own base_stat/base_map row under the SAME id.
CREATE FUNCTION base_realize_sibling_borrow(p_pack text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  b base_sibling_borrow%ROWTYPE;
  sib_carrier text; via_fn text; via_codomain text;
  src_fn text; src_title text; src_codomain text; dst_carrier text;
  fn_name text;
BEGIN
  FOR b IN SELECT * FROM base_sibling_borrow WHERE pack = p_pack ORDER BY collection, kind, id LOOP
    SELECT carrier INTO sib_carrier FROM base_collection WHERE id = b.collection;

    -- the transporting bijection: a base_map row OWNED BY the sibling, landing in from_collection.
    SELECT mapping_fn, codomain INTO via_fn, via_codomain FROM base_map WHERE collection = b.collection AND map_id = b.via_map;
    IF via_fn IS NULL THEN
      RAISE EXCEPTION 'base_sibling_borrow: %.% has no map %(via_map) to transport %.% through', b.collection, b.via_map, b.via_map, b.from_collection, b.id;
    END IF;
    IF via_codomain IS DISTINCT FROM b.from_collection THEN
      RAISE EXCEPTION 'base_sibling_borrow: %.% lands in % but from_collection is %', b.collection, b.via_map, via_codomain, b.from_collection;
    END IF;

    fn_name := regexp_replace(b.collection || '_' || b.id || '_borrowed_' || b.kind, '[^a-zA-Z0-9_]+', '_', 'g');

    IF b.kind = 'stat' THEN
      SELECT value_fn, title, codomain INTO src_fn, src_title, src_codomain FROM base_stat WHERE collection = b.from_collection AND stat_id = b.id;
      IF src_fn IS NULL THEN
        RAISE EXCEPTION 'base_sibling_borrow: no stat %.% to borrow onto %', b.from_collection, b.id, b.collection;
      END IF;
      EXECUTE format('CREATE FUNCTION %I(e %I) RETURNS numeric LANGUAGE sql IMMUTABLE AS $b$ SELECT %I(%I(e))::numeric $b$',
                      fn_name, sib_carrier, src_fn, via_fn);
      INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain, pack)
        VALUES (b.collection, b.id, fn_name, coalesce(src_title, b.id), src_codomain, b.pack);
    ELSE   -- kind = 'map'
      SELECT mapping_fn, title, codomain INTO src_fn, src_title, src_codomain FROM base_map WHERE collection = b.from_collection AND map_id = b.id;
      IF src_fn IS NULL THEN
        RAISE EXCEPTION 'base_sibling_borrow: no map %.% to borrow onto %', b.from_collection, b.id, b.collection;
      END IF;
      SELECT carrier INTO dst_carrier FROM base_collection WHERE id = src_codomain;
      EXECUTE format('CREATE FUNCTION %I(e %I) RETURNS %I LANGUAGE sql IMMUTABLE AS $b$ SELECT %I(%I(e)) $b$',
                      fn_name, sib_carrier, dst_carrier, src_fn, via_fn);
      INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, pack)
        VALUES (b.collection, b.id, fn_name, src_codomain, coalesce(src_title, b.id), b.pack);
    END IF;
  END LOOP;
END $$;

INSERT INTO base_finalizer (id, fn, description, scope) VALUES
  ('sibling_borrow', 'base_realize_sibling_borrow', 'Realize base_sibling_borrow opt-in stat/map transports across a '
   'sibling''s own bijection (codegen: see #401).', 'pack');

-- ── examples (mechanism-only — the concrete lehmer_codes/permutations proof lives with that opt-in row, in
-- permutations-plus, since it references a pack collection; see sqlsrc for the registration + differential) ──────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sibling_borrow', 'base_realize_sibling_borrow on a pack owning no borrow rows is a safe no-op', 'ok', NULL,
   'mirrors realizer.sql''s base_pack_finalize no-op assertion — an empty WHERE pack=... loop must not raise',
   $q$ SELECT base_realize_sibling_borrow('__nonexistent_pack__') $q$),
  ('sibling_borrow', 'the sibling_borrow finalizer is registered pack-scope', 'eq', 'true',
   'base_pack_finalize(pack) must call this once per pack, not once per collection — the registry is a small '
   'curated table, not shaped per-collection',
   $q$ SELECT EXISTS (SELECT 1 FROM base_finalizer WHERE id = 'sibling_borrow' AND fn = 'base_realize_sibling_borrow'::regproc AND scope = 'pack')::text $q$);
