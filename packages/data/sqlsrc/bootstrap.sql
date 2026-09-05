-- pg-enumeratio-base bootstrap: the example harness (the living assertions) + shared primitives.
-- The MODEL (code-is-the-spec): a collection provides an ITERATOR (the floor). An element is
-- (fiber, ordinality, value): `fiber` a TYPED per-collection fiber (the grade address, a chain of int4range),
-- `ordinality` the position within the fiber, `value` the carrier value. Composite ordering (fiber →
-- ordinality → value) IS the global rank. unrank/rank/cardinality/contains are DERIVED from the iterator;
-- closed-form engines are opt-in ACCELERATIONS. Restrictions are derived collections. Numbers are not special.

-- ── example harness ────────────────────────────────────────────────────────────────────────────────────
-- `suite` is the display/group label; `collection` is the CATALOG FACET link (like base_stat/base_repr/base_map),
-- auto-derived from the suite when it names a collection (they are kept equal by convention). A cross-cutting
-- suite (maps, representations, boundary, …) is not a collection id, so its examples stay collection = NULL.
-- `slow` tiers an example out of the DEFAULT gate: a handful of integration/oracle-class assertions (full-catalog
-- sweeps like search_sequence/find_stat, full enumerations like the Catalan thesis / perfect-number searches) are
-- ~90% of total example runtime. base_run_examples() skips them unless asked (run.mts lifts EXAMPLES=all). They are
-- flagged after load by example-tiers.sql, so the source files stay untouched.
CREATE TABLE base_example (suite text, title text, kind text, expected text, description text, sql text, collection text,
                           slow boolean NOT NULL DEFAULT false);

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

-- base_raises(sql): true iff running `sql` raises — for LIVING negative assertions (a 'eq' example expecting 'true').
CREATE FUNCTION base_raises(sql text) RETURNS boolean LANGUAGE plpgsql AS $$
  BEGIN EXECUTE sql; RETURN false; EXCEPTION WHEN OTHERS THEN RETURN true; END $$;

-- a self-check so an empty base still reports something green
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('base', 'harness runs', 'eq', '1', 'the example harness itself works', $q$ SELECT 1::text $q$);
