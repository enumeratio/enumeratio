-- requires: bootstrap
-- Opt-in, namespaced debug probes (issue #200) — the SQL half of a convention shared with the TS side (the node
-- `debug` library). Namespaces read `enumeratio:<pkg>:<area>` (e.g. `enumeratio:data:findstat`,
-- `enumeratio:data:unrank`); enabled via the DEBUG env var, using `debug`'s own syntax — comma-separated, a
-- trailing `*` wildcard, a leading `-` to exclude (`enumeratio:data:*`, `enumeratio:*,-enumeratio:data:unrank`).
-- SQL has no env access, so a host's boot path lifts DEBUG into the session as a custom GUC (`enumeratio.debug`,
-- a plain string — Postgres treats any dotted, unregistered name as a placeholder, no extension needed) once at
-- session start; debug_enabled() reads it back with current_setting(..., true) (missing_ok, so an unset GUC is
-- just an empty string, not an error). Zero-cost when off: one current_setting + a short comma-split, no I/O.
--
-- HOT-LOOP PATTERN: don't call debug_enabled() per iteration — call it ONCE into a local boolean before the loop,
-- then gate each RAISE NOTICE on that boolean inside:
--   dbg := debug_enabled('enumeratio:data:unrank');
--   ... LOOP ... IF dbg THEN RAISE NOTICE '[enumeratio:data:unrank] ...', ...; END IF; ... END LOOP;
-- so the off-path per-iteration cost is a single boolean test, not a GUC read + pattern match every time round.
-- See subset_unrank_colex (subsets.sql) and find_stat (find_stat.sql) for the pattern applied to a real hot loop.

-- debug_ns_matches(ns, pattern): does `ns` match one `debug`-style pattern? A trailing `*` is a prefix wildcard
-- (`enumeratio:data:*` matches `enumeratio:data:unrank`; bare `*` matches everything); otherwise exact match.
CREATE FUNCTION debug_ns_matches(ns text, pattern text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN right(pattern, 1) = '*' THEN starts_with(ns, left(pattern, -1)) ELSE ns = pattern END
$$;

-- debug_enabled(ns): is namespace `ns` turned on by the current session's `enumeratio.debug` GUC? Positive patterns
-- OR together; any matching `-`-prefixed pattern excludes regardless of order (mirrors the `debug` package: a skip
-- always wins). Unset/empty GUC ⇒ false, cheaply (no split, no loop).
CREATE FUNCTION debug_enabled(ns text) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE patterns text; p text; enabled boolean := false; excluded boolean := false;
  BEGIN
    patterns := current_setting('enumeratio.debug', true);
    IF patterns IS NULL OR patterns = '' THEN RETURN false; END IF;
    FOREACH p IN ARRAY string_to_array(patterns, ',') LOOP
      p := trim(p);
      IF p = '' THEN CONTINUE;
      ELSIF left(p, 1) = '-' THEN
        IF debug_ns_matches(ns, substring(p FROM 2)) THEN excluded := true; END IF;
      ELSE
        IF debug_ns_matches(ns, p) THEN enabled := true; END IF;
      END IF;
    END LOOP;
    RETURN enabled AND NOT excluded;
  END $$;

-- debug_log(ns, msg): a gated RAISE NOTICE, prefixed with its namespace — the plain, non-hot-loop call site. A
-- probe INSIDE a tight loop should capture debug_enabled(ns) once instead (see the hot-loop pattern above).
CREATE FUNCTION debug_log(ns text, msg text) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN IF debug_enabled(ns) THEN RAISE NOTICE '[%] %', ns, msg; END IF; END $$;

-- debug_logf(ns, fmt, ...): the format()-style variadic sibling, for a probe with several values to interpolate.
CREATE FUNCTION debug_logf(ns text, fmt text, VARIADIC args text[]) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN IF debug_enabled(ns) THEN RAISE NOTICE '[%] %', ns, format(fmt, VARIADIC args); END IF; END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('debug','debug_enabled is false with the GUC unset','eq','false','the off-by-default floor',$q$
    SELECT debug_enabled('enumeratio:data:unrank')::text $q$),

  ('debug','a wildcard namespace turns on an exact sub-namespace','eq','true','set_config(...,true) is LOCAL to this example''s statement — see below',$q$
    WITH _ AS (SELECT set_config('enumeratio.debug', 'enumeratio:data:*', true))
    SELECT debug_enabled('enumeratio:data:unrank')::text FROM _ $q$),

  ('debug','an unrelated namespace stays off under a narrower wildcard','eq','false','enumeratio:data:* does not turn on enumeratio:client:*',$q$
    WITH _ AS (SELECT set_config('enumeratio.debug', 'enumeratio:data:*', true))
    SELECT debug_enabled('enumeratio:client:worker')::text FROM _ $q$),

  ('debug','a leading - exclusion wins over a broader wildcard','eq','false|true','enumeratio:*,-enumeratio:data:unrank turns everything on except that one namespace',$q$
    WITH _ AS (SELECT set_config('enumeratio.debug', 'enumeratio:*,-enumeratio:data:unrank', true))
    SELECT debug_enabled('enumeratio:data:unrank')::text || '|' || debug_enabled('enumeratio:data:findstat')::text FROM _ $q$),

  ('debug','set_config(...,is_local=true) does not leak past this example','eq','false','plpgsql''s per-example BEGIN/EXCEPTION block is itself a subtransaction, so the LOCAL setting unwinds with it — the NEXT example sees it unset again',$q$
    SELECT debug_enabled('enumeratio:data:unrank')::text $q$),

  ('debug','debug_log / debug_logf never raise, on or off','ok',NULL,'the gated RAISE NOTICE call sites are safe to leave in hot code paths',$q$
    WITH _ AS (SELECT set_config('enumeratio.debug', 'enumeratio:data:*', true))
    SELECT debug_log('enumeratio:data:unrank', 'probe'), debug_logf('enumeratio:data:unrank', 'n=%s k=%s', '4', '2') FROM _ $q$);
