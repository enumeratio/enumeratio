-- pg-enumeratio-base bootstrap: the example harness (the living assertions) + shared primitives.
-- The MODEL (code-is-the-spec): a collection provides an ITERATOR (the floor). An element is
-- (fiber, ordinality, value): `fiber` a TYPED per-collection fiber (the grade address, a chain of int4range),
-- `ordinality` the position within the fiber, `value` the carrier value. Composite ordering (fiber →
-- ordinality → value) IS the global rank. unrank/rank/cardinality/contains are DERIVED from the iterator;
-- closed-form engines are opt-in ACCELERATIONS. Restrictions are derived collections. Numbers are not special.

-- ── pack provenance (#283 core/packs split, phase 0.2) ────────────────────────────────────────────────────
-- base_pack is the irreducible seed: every OWNING registry's `pack` column FK-targets it, so it must exist before
-- any registry table is created — hence it lives here, first, ahead of base_example. Today every row is 'core';
-- this phase is data-only plumbing with zero behaviour change (no pack besides 'core' is ever loaded).
CREATE TABLE base_pack (id text PRIMARY KEY, version text NOT NULL, requires text[] NOT NULL DEFAULT '{}');
INSERT INTO base_pack VALUES ('core', '0.1.0', '{}');

-- base_guard_pack: the provenance contract, enforced. A pack may UPDATE/DELETE only rows IT owns (OLD.pack matches
-- the session's current enumeratio.pack GUC); both sides coalesce to 'core' so an unset GUC (today, always) means
-- "core may touch core". The loader sets enumeratio.pack before a pack's files load (one session per pack); authors
-- write nothing — the column and the guard are structural, not per-file plumbing.
CREATE FUNCTION base_guard_pack() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.pack IS DISTINCT FROM coalesce(current_setting('enumeratio.pack', true), 'core') THEN
    RAISE EXCEPTION 'pack % may not % a row owned by pack %', coalesce(current_setting('enumeratio.pack', true), 'core'), TG_OP, OLD.pack;
  END IF;
  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END $$;

-- probes for the self-tests at the foot of this file. Each catches its OWN exception (a nested BEGIN/EXCEPTION,
-- not the outer base_raises helper) so a set_config change is undone explicitly rather than trusted to an outer
-- savepoint rollback — a bogus enumeratio.pack leaking past this probe would corrupt every later example.
CREATE FUNCTION base_pack_guard_test() RETURNS boolean LANGUAGE plpgsql AS $$
-- coalesce to 'core' up front: set_config(name, NULL, true) "resets to default" leaves a placeholder GUC reading
-- '' (empty string), not NULL again — restoring literal NULL would silently swap the guard's fallback from 'core'
-- to '' and corrupt every example that runs after this one.
DECLARE prior text := coalesce(current_setting('enumeratio.pack', true), 'core'); fired boolean := false;
BEGIN
  PERFORM set_config('enumeratio.pack', 'bogus_pack_zzz', true);
  BEGIN
    UPDATE base_collection SET carrier = carrier WHERE id = (SELECT id FROM base_collection ORDER BY id LIMIT 1);
  EXCEPTION WHEN OTHERS THEN fired := true;
  END;
  PERFORM set_config('enumeratio.pack', prior, true);
  RETURN fired;
END $$;

CREATE FUNCTION base_pack_guard_allows_same_pack_test() RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE fired boolean := false;
BEGIN
  BEGIN
    UPDATE base_map SET is_bijection = is_bijection
     WHERE (collection, map_id) = (SELECT collection, map_id FROM base_map ORDER BY collection, map_id LIMIT 1);
  EXCEPTION WHEN OTHERS THEN fired := true;
  END;
  RETURN NOT fired;
END $$;

-- ── example harness ────────────────────────────────────────────────────────────────────────────────────
-- `suite` is the display/group label; `collection` is the CATALOG FACET link (like base_stat/base_repr/base_map),
-- auto-derived from the suite when it names a collection (they are kept equal by convention). A cross-cutting
-- suite (maps, representations, boundary, …) is not a collection id, so its examples stay collection = NULL.
-- `slow` tiers an example out of the DEFAULT gate: a handful of integration/oracle-class assertions (full-catalog
-- sweeps like search_sequence/find_stat, full enumerations like the Catalan thesis / perfect-number searches) are
-- ~90% of total example runtime. base_run_examples() skips them unless asked (run.mts lifts EXAMPLES=all). They are
-- flagged after load by example-tiers.sql, so the source files stay untouched.
-- `pack`: OWNING registry provenance (#283) — which pack contributed this example; every row is 'core' today.
CREATE TABLE base_example (suite text, title text, kind text, expected text, description text, sql text, collection text,
                           slow boolean NOT NULL DEFAULT false,
                           pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_example_pack_guard BEFORE UPDATE OR DELETE ON base_example FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

CREATE FUNCTION base_example_link() RETURNS trigger LANGUAGE plpgsql AS $$
  BEGIN                                                        -- once base_collection exists; explicit values win
    IF NEW.collection IS NULL AND to_regclass('base_collection') IS NOT NULL THEN
      NEW.collection := (SELECT id FROM base_collection WHERE id = NEW.suite);
    END IF;
    RETURN NEW;
  END $$;
CREATE TRIGGER base_example_link BEFORE INSERT ON base_example FOR EACH ROW EXECUTE FUNCTION base_example_link();

-- include_slow=false (the default gate) runs only the fast tier; run.mts passes true when EXAMPLES=all.
CREATE FUNCTION base_run_examples(include_slow boolean DEFAULT false)
RETURNS TABLE(suite text, title text, passed boolean, expected text, actual text)
LANGUAGE plpgsql AS $$
  DECLARE e record; res text; ok boolean;
  BEGIN
    FOR e IN SELECT * FROM base_example WHERE include_slow OR NOT slow LOOP
      BEGIN
        IF e.kind = 'ok' THEN EXECUTE e.sql; res := NULL; ok := true;                 -- ran without error
        ELSE EXECUTE e.sql INTO res; ok := (res IS NOT DISTINCT FROM e.expected); END IF;   -- 'eq': value = expected
      EXCEPTION WHEN OTHERS THEN res := SQLERRM; ok := false;
      END;
      suite := e.suite; title := e.title; passed := ok; expected := e.expected; actual := res; RETURN NEXT;
    END LOOP;
  END $$;

-- Per-pack overload (#283 phase 0.3): `packs` NULL = every pack (today's behaviour, unchanged). `packs` non-NULL
-- filters on `base_example.pack`, the same column base_guard_pack already enforces — `run.mts --packs core`
-- passes `ARRAY['core']` for the self-containment probe (core's own examples, run alone, on a catalog with no
-- packs loaded at all). GOTCHA: `base_run_examples(true)` — the bare 1-arg call — is genuinely AMBIGUOUS once
-- this overload exists; Postgres does NOT prefer the candidate needing fewer defaults filled in, it just errors
-- "function … is not unique". The 1-arg function above stays for source compat (nothing outside this file ever
-- called the bare form), but every real call site (run.mts) now passes both args explicitly — never rely on the
-- 1-arg form resolving once a second overload is in scope.
CREATE FUNCTION base_run_examples(include_slow boolean, packs text[] DEFAULT NULL)
RETURNS TABLE(suite text, title text, passed boolean, expected text, actual text)
LANGUAGE plpgsql AS $$
  DECLARE e record; res text; ok boolean;
  BEGIN
    FOR e IN SELECT * FROM base_example WHERE (include_slow OR NOT slow) AND (packs IS NULL OR pack = ANY(packs)) LOOP
      BEGIN
        IF e.kind = 'ok' THEN EXECUTE e.sql; res := NULL; ok := true;                 -- ran without error
        ELSE EXECUTE e.sql INTO res; ok := (res IS NOT DISTINCT FROM e.expected); END IF;   -- 'eq': value = expected
      EXCEPTION WHEN OTHERS THEN res := SQLERRM; ok := false;
      END;
      suite := e.suite; title := e.title; passed := ok; expected := e.expected; actual := res; RETURN NEXT;
    END LOOP;
  END $$;

-- base_raises(sql): true iff running `sql` raises — for LIVING negative assertions (a 'eq' example expecting 'true').
CREATE FUNCTION base_raises(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
  BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

-- a self-check so an empty base still reports something green
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base', 'harness runs', 'eq', '1', 'the example harness itself works', $q$ SELECT 1::text $q$);

-- ── pack provenance self-tests (#283 phase 0.2) — floors/containment, never exact counts ────────────────────
-- The 15 OWNING registries this phase touches (spelled literally, mirroring engine_grants.sql's SelectKind self-
-- test convention): base_collection/stat/map/example/function/function_impl/engine_grant/reference/glyph/species/
-- generating_function/sequence_transform/stat_suppressed/triangle_refines/set_builder. Everything else in the
-- corpus is a per-collection child/link table (base_grade, base_repr, base_polytope, …) or a computed sweep
-- (base_stat_derived) — its provenance is implied by the base_collection row it hangs off, so it stays bare.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('pack', 'base_pack seeds the core row', 'eq', '0.1.0',
   'the irreducible seed — every owning registry''s pack column FK-targets this row',
   $q$ SELECT coalesce((SELECT version FROM base_pack WHERE id = 'core'), 'MISSING') $q$),

  ('pack', 'every owning registry carries a NOT NULL pack column', 'eq', '0',
   'the 15 tables #283 phase 0.2 touches all got the column at CREATE TABLE time (never a trailing ALTER)',
   $q$ SELECT count(*)::text FROM unnest(ARRAY[
         'base_collection','base_stat','base_map','base_example','base_function','base_function_impl',
         'base_engine_grant','base_reference','base_glyph','base_species','base_generating_function',
         'base_sequence_transform','base_stat_suppressed','base_triangle_refines','base_set_builder'
       ]) t(table_name)
      WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c
                          WHERE c.table_name = t.table_name AND c.column_name = 'pack' AND c.is_nullable = 'NO') $q$),

  ('pack', 'every row in every owning registry is pack = core today', 'eq', '0',
   'phase 0.2 is data-only plumbing — zero behaviour change means nothing but core has ever loaded',
   $q$ SELECT count(*)::text FROM (
         SELECT count(*) n FROM base_collection WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_stat WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_map WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_example WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_function WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_function_impl WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_engine_grant WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_reference WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_glyph WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_species WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_generating_function WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_sequence_transform WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_stat_suppressed WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_triangle_refines WHERE pack <> 'core'
         UNION ALL SELECT count(*) FROM base_set_builder WHERE pack <> 'core'
       ) x WHERE n <> 0 $q$),

  ('pack', 'base_guard_pack fires when a foreign pack touches a core-owned row', 'eq', 'true',
   'the probe sets enumeratio.pack to a bogus value then updates a real base_collection row — must raise. Uses its '
   'own nested BEGIN/EXCEPTION (not base_raises) so the GUC is restored explicitly rather than relying on an outer '
   'savepoint rollback — a bogus setting leaking across examples would corrupt every later pack self-test',
   $q$ SELECT base_pack_guard_test()::text $q$),

  ('pack', 'base_guard_pack allows a same-pack update (the legal in-core UPDATE base_map / base_example sites)', 'eq', 'true',
   'regression guard for map_compose.sql / standard_tableaux.demotion.sql / integer_partitions.cores_quotients.sql '
   '/ example-tiers.sql: an unset GUC coalesces to core on both sides, so core may still touch its own rows',
   $q$ SELECT base_pack_guard_allows_same_pack_test()::text $q$);
-- NOTE (#283 phase 0.3): no base_example row here exercises `base_run_examples(include_slow, packs)` by CALLING
-- it — an example's `sql` runs FROM INSIDE a live base_run_examples() invocation (the FOR loop above), and pglite
-- silently returns zero rows from a plpgsql set-returning function invoked recursively from within its own
-- execution (confirmed by hand: real Postgres tolerates this, pglite/wasm does not) — a far worse failure mode
-- than a normal exception, since it zeroes out EVERY row of the outer run, not just this one. The functional proof
-- is `run.mts --packs core` producing today's exact example count (verified as part of this task, not re-asserted
-- as a base_example row to dodge the recursion trap and keep the example count byte-for-byte unchanged).
