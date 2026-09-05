-- requires: permutations.stats, statistics
-- (the "reverse_complement compound is possibly_aliased" example, which needs permutation_maps.sql's hand-rolled
-- reverse_complement row to exist, moved to packs/permutations-plus/map_compose.permutations-plus.sql — #283
-- phase 3; note packs/refs/examples.map_compose.sql already owns that basename, so this uses the <anchor>.<pack>
-- naming instead, per #308)
-- map_compose — issue #128: a composition operator over base_map rows, g∘f: A→C from f: A→B and g: B→C, plus
-- derived stat∘map compounds (a stat on the far end of a map chain, pulled back to a stat on the start).
--
-- MAINTAINER DECISION (materialized vs virtual, flagged in the original design pass): MATERIALIZE — curated
-- compounds become real base_map / base_stat rows, not a query-time-only view. Rationale kept here for the record:
-- a materialized row is discoverable the SAME way a hand-authored map is (client .maps()/.stats(), window
-- projections, base_relation promotion) without callers needing to know composition happened at all; a purely
-- virtual layer would have kept compounds invisible to everything except code that explicitly asks for a chain.
-- The CURATION discipline (not every composable pair) keeps this from exploding: only a small, hand-picked set
-- below is actually registered.
--
-- THE MECHANISM (unchanged from the original pass). map_compose_resolve(collection, map_path) walks the chain
-- through base_map_resolved (so carrier-inherited maps compose too), re-binding the running collection to each
-- step's codomain — a step that isn't a map on the previous step's codomain fails immediately (the lookup finds
-- nothing), which IS the domain/codomain guard. It builds a %s-templated SQL expression (expr_tpl) by wrapping the
-- running template in each fn name — format('%I(%s)', fn, expr_tpl) — the same textual-composition idiom already
-- trusted in core.ts's resolveChain/opts.through and find_stat.sql's depth-1 value_expr. It folds is_bijection/
-- is_order_iso (AND across steps) and SCOPE ('carrier' only if every step is carrier-scope, else 'collection' —
-- a chain that touches a collection-bound step can't carrier-inherit as a whole).
--
-- MATERIALIZERS. map_compose_materialize(collection, map_path, map_id, …) resolves a chain, generates a named SQL
-- wrapper function (CREATE FUNCTION <collection>__<map_id>(x <domain_carrier>) RETURNS <codomain_carrier> AS SELECT
-- <expr_tpl applied to x>), and INSERTs the base_map row — a real, queryable map, indistinguishable from a
-- hand-authored one once registered. map_compose_stat_materialize does the same for a stat pulled back along a
-- chain, landing in base_stat. Both refuse to double-register an existing (collection, id) — see the ALIAS
-- reconciliation below, not a duplicate-row mechanism.
--
-- map_compose_over / map_compose_stat_over remain as the VIRTUAL preview/proof tool: apply a resolved chain across
-- a bounded sweep (find_stat.sql's find_stat_source) without registering anything — used below to PROVE each
-- materialized compound before/alongside registering it, and to prove the mechanism at depth 3 for a compound that
-- deliberately ISN'T registered (see the depth-3 mechanism check). This is also the literal generalization that
-- would feed the finder's depth>1 (find_stat.sql today hardcodes a single map_path[1] hop) — wiring it in is left
-- to the maintainer as a follow-up, not done on this branch.
--
-- base_map_compound is the DISCOVERY VIEW: every depth-2 composable (f,g) pair, computed on demand (same tier as
-- base_map_resolved) — the candidate list the curated set below was picked FROM. `possibly_aliased` flags a pair
-- whose (domain,codomain) already has a different hand-authored base_map row — a cheap heuristic ("check before you
-- mint"), not a proof of semantic equivalence.

-- ── the composition mechanism ───────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION map_compose_resolve(p_collection text, p_map_path text[],
    OUT codomain text, OUT expr_tpl text, OUT is_bijection boolean, OUT is_order_iso boolean, OUT scope text)
LANGUAGE plpgsql STABLE AS $$
  DECLARE coll text := p_collection; id text; fn text; step_bij boolean; step_iso boolean; step_scope text;
  BEGIN
    IF coalesce(array_length(p_map_path, 1), 0) = 0 THEN
      RAISE EXCEPTION 'map_compose_resolve: empty map_path on %', p_collection;
    END IF;
    expr_tpl := '%s'; is_bijection := true; is_order_iso := true; scope := 'carrier';
    FOREACH id IN ARRAY p_map_path LOOP
      SELECT m.mapping_fn, m.codomain, m.is_bijection, m.is_order_iso, m.scope
        INTO fn, coll, step_bij, step_iso, step_scope
        FROM base_map_resolved m WHERE m.collection = coll AND m.map_id = id;
      IF fn IS NULL THEN RAISE EXCEPTION 'map_compose_resolve: unknown map ''%'' on %', id, coll; END IF;
      expr_tpl := format('%I(%s)', fn, expr_tpl);              -- wrap the running template: fn(...)
      is_bijection := is_bijection AND coalesce(step_bij, false);
      is_order_iso := is_order_iso AND coalesce(step_iso, false);
      IF step_scope <> 'carrier' THEN scope := 'collection'; END IF;   -- one collection-bound step taints the whole chain
    END LOOP;
    codomain := coll;
  END $$;

-- Apply a resolved chain across a bounded sweep of p_collection (find_stat.sql's own source builder) — the VIRTUAL
-- preview/proof path, used to verify a compound before (or instead of) registering it.
CREATE FUNCTION map_compose_over(p_collection text, p_map_path text[],
    p_size_cap int DEFAULT 6, p_per_fiber_cap int DEFAULT 500)
RETURNS TABLE(domain_render text, codomain_render text) LANGUAGE plpgsql STABLE AS $$
  DECLARE r record; src text := find_stat_source(p_collection, p_size_cap, p_per_fiber_cap);
  BEGIN
    r := map_compose_resolve(p_collection, p_map_path);
    RETURN QUERY EXECUTE format('SELECT render_value((e).value), render_value(%s) FROM %s',
      format(r.expr_tpl, '(e).value'), src);
  END $$;

-- Pull a stat back along a resolved chain: p_stat_id is looked up on the chain's FINAL codomain (via
-- base_stat_resolved), then evaluated as stat(mapN(...map1(x)...)) — find_stat.sql's depth-1 value_expr,
-- generalized to an N-step map_path.
CREATE FUNCTION map_compose_stat_over(p_collection text, p_map_path text[], p_stat_id text,
    p_size_cap int DEFAULT 6, p_per_fiber_cap int DEFAULT 500)
RETURNS TABLE(domain_render text, stat_value numeric) LANGUAGE plpgsql STABLE AS $$
  DECLARE r record; value_fn text; src text := find_stat_source(p_collection, p_size_cap, p_per_fiber_cap);
  BEGIN
    r := map_compose_resolve(p_collection, p_map_path);
    SELECT s.value_fn INTO value_fn FROM base_stat_resolved s WHERE s.collection = r.codomain AND s.stat_id = p_stat_id;
    IF value_fn IS NULL THEN RAISE EXCEPTION 'map_compose_stat_over: unknown stat ''%'' on %', p_stat_id, r.codomain; END IF;
    RETURN QUERY EXECUTE format('SELECT render_value((e).value), (%I(%s))::numeric FROM %s',
      value_fn, format(r.expr_tpl, '(e).value'), src);
  END $$;

-- ── materializers: resolve once, generate a named wrapper fn, register a real registry row ───────────────────────
-- Naming: <collection>__<map_id> for the backing SQL function (unique per collection, never collides with a
-- hand-authored fn name); map_id itself follows FindStat's own "<g>oMp<f>" convention, spelled out as
-- <g>_after_<f> (systematic, and reads in APPLICATION order right-to-left, same as ordinary function composition
-- notation). SCOPE is whatever map_compose_resolve folded (carrier-scope factors compose to a carrier-scope map).
CREATE FUNCTION map_compose_materialize(p_collection text, p_map_path text[], p_map_id text,
    p_title text DEFAULT NULL, p_findstat text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
  DECLARE r record; domain_carrier text; codomain_carrier text; fn_name text;
  BEGIN
    IF EXISTS (SELECT 1 FROM base_map WHERE collection = p_collection AND map_id = p_map_id) THEN
      RAISE EXCEPTION 'map_compose_materialize: %.% already registered — alias to it, do not re-derive', p_collection, p_map_id;
    END IF;
    r := map_compose_resolve(p_collection, p_map_path);
    SELECT carrier INTO domain_carrier FROM base_collection WHERE id = p_collection;
    SELECT carrier INTO codomain_carrier FROM base_collection WHERE id = r.codomain;
    fn_name := format('%s__%s', p_collection, p_map_id);
    EXECUTE format('CREATE FUNCTION %I(x %s) RETURNS %s LANGUAGE sql IMMUTABLE AS $body$ SELECT %s $body$',
      fn_name, domain_carrier, codomain_carrier, format(r.expr_tpl, 'x'));
    INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat, scope, is_bijection, is_order_iso)
      VALUES (p_collection, p_map_id, fn_name, r.codomain,
              coalesce(p_title, array_to_string(p_map_path, ' → ')), p_findstat, r.scope, r.is_bijection, r.is_order_iso);
    RETURN fn_name;
  END $$;

-- Same shape for a stat pulled back along a chain — lands in base_stat instead of base_map. The wrapper's return
-- type is discovered from the pulled-back stat's own value_fn (pg_proc), so it matches whatever that stat returns
-- (int, numeric, …) rather than assuming numeric.
CREATE FUNCTION map_compose_stat_materialize(p_collection text, p_map_path text[], p_stat_id text, p_derived_stat_id text,
    p_title text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
  DECLARE r record; value_fn text; stat_codomain text; domain_carrier text; return_type text; fn_name text;
  BEGIN
    IF EXISTS (SELECT 1 FROM base_stat WHERE collection = p_collection AND stat_id = p_derived_stat_id) THEN
      RAISE EXCEPTION 'map_compose_stat_materialize: %.% already registered — alias to it, do not re-derive', p_collection, p_derived_stat_id;
    END IF;
    r := map_compose_resolve(p_collection, p_map_path);
    SELECT s.value_fn, s.codomain INTO value_fn, stat_codomain
      FROM base_stat_resolved s WHERE s.collection = r.codomain AND s.stat_id = p_stat_id;
    IF value_fn IS NULL THEN RAISE EXCEPTION 'map_compose_stat_materialize: unknown stat ''%'' on %', p_stat_id, r.codomain; END IF;
    SELECT carrier INTO domain_carrier FROM base_collection WHERE id = p_collection;
    SELECT format_type(p.prorettype, NULL) INTO return_type
      FROM pg_proc p WHERE p.proname = value_fn AND p.pronargs = 1;
    fn_name := format('%s__%s', p_collection, p_derived_stat_id);
    EXECUTE format('CREATE FUNCTION %I(x %s) RETURNS %s LANGUAGE sql IMMUTABLE AS $body$ SELECT %I(%s) $body$',
      fn_name, domain_carrier, return_type, value_fn, format(r.expr_tpl, 'x'));
    INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain)
      VALUES (p_collection, p_derived_stat_id, fn_name, coalesce(p_title, p_stat_id || ' ∘ ' || array_to_string(p_map_path, ',')), stat_codomain);
    RETURN fn_name;
  END $$;

-- ── discoverability: every depth-2 composable (f,g) pair, computed on demand ──────────────────────────────────
CREATE VIEW base_map_compound AS
  SELECT f.collection AS domain, g.codomain,
         ARRAY[f.map_id, g.map_id] AS map_path,
         (f.is_bijection AND g.is_bijection) AS is_bijection,
         (f.is_order_iso AND g.is_order_iso) AS is_order_iso,
         coalesce(f.title, f.map_id) || ' → ' || coalesce(g.title, g.map_id) AS title,
         EXISTS (SELECT 1 FROM base_map existing
                   WHERE existing.collection = f.collection AND existing.codomain = g.codomain
                     AND existing.map_id <> ALL (ARRAY[f.map_id, g.map_id])) AS possibly_aliased
    FROM base_map_resolved f
    JOIN base_map_resolved g ON g.collection = f.codomain;

-- ── bijection-flag fixes, scoped to exactly the maps the curated compounds below touch ────────────────────────
-- reverse/complement/inverse (permutations) are each involutions — f(f(x))=x is already asserted per-map (maps.sql,
-- permutations.stats.sql) — so each IS a bijection; base_map's is_bijection sat at the false default because
-- scope='carrier' rows were never DECLARED (only scope='collection' pairs feed base_relation's promotion, so
-- nobody needed the flag before). conjugate (integer_partitions) is likewise an already-proven involution
-- (maps.sql). Declaring these true here lets the compounds below AND-fold to the correct value instead of freezing
-- a wrong false into new rows. Deliberately LEFT UNTOUCHED: foata (permutation_maps.sql) — this branch derives no
-- compound from it; cycle_type — correctly false already (many permutations share a cycle type, genuinely not
-- injective), nothing to fix.
UPDATE base_map SET is_bijection = true
 WHERE (collection, map_id) IN (('permutations','reverse'), ('permutations','complement'), ('permutations','inverse'),
                                 ('integer_partitions','conjugate'));

-- ── curated compounds ───────────────────────────────────────────────────────────────────────────────────────────
-- M1 (depth-2 map): the conjugate of a permutation's cycle type. New — no existing base_map row covers it.
SELECT map_compose_materialize('permutations', ARRAY['cycle_type','conjugate'], 'conjugate_after_cycle_type',
  'Conjugate of the cycle type');

-- M2 (depth-3 map — the explicitly requested depth>2 case): compose three independently-registered permutation
-- endomorphisms (reverse, complement, inverse) into one. New — no existing base_map row covers it. (It also turns
-- out to be an involution itself — proven below alongside the derivation — though that's not required to register it.)
SELECT map_compose_materialize('permutations', ARRAY['reverse','complement','inverse'], 'inverse_after_complement_after_reverse',
  'Inverse of the reverse-complement (composes the two permutohedron symmetries with permutation inversion)');

-- S1 (depth-1 stat pullback): the longest cycle length. find_stat.sql's own examples already prove no DIRECT
-- permutation stat reproduces this (depth-0 sweep finds no full match) — genuinely new, not a duplicate.
SELECT map_compose_stat_materialize('permutations', ARRAY['cycle_type'], 'largest_part', 'longest_cycle_length',
  'Length of the longest cycle');

-- ── ALIAS reconciliation, not duplication ──────────────────────────────────────────────────────────────────────
-- [reverse,complement] (either order) composes to exactly the existing hand-rolled 'reverse_complement' map
-- (permutation_maps.sql) — NOT re-registered here; base_map_compound flags it possibly_aliased (below), and the
-- example under "derives the hand-rolled reverse_complement" proves the equivalence directly.
-- [cycle_type,conjugate] pulled back through 'largest_part' equals the independently-registered 'cycle_count' stat
-- (perm_cycle_count, statistics.sql — a partition's conjugate's first part counts its parts) — also NOT
-- re-registered as a second stat_id computing the same quantity; proven by example instead, same treatment as the
-- reverse_complement alias.

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('map_compose', 'map_compose_resolve guards a mismatched chain: [cycle_type,reverse] fails — reverse is not a map on integer_partitions',
   'eq', 'true', 'the domain/codomain guard is "the next lookup finds nothing", not a bolted-on type check',
   $q$ SELECT base_raises($e$ SELECT (map_compose_resolve('permutations', ARRAY['cycle_type','reverse'])).codomain $e$)::text $q$),

  ('map_compose', 'M1 conjugate_after_cycle_type is a REAL base_map row now, agreeing with directly nesting its factors',
   'eq', 'integer_partitions|true', 'codomain typing, and the materialized fn matches conjugate(cycle_type(p)) computed by hand',
   $q$
     SELECT (SELECT codomain FROM base_map WHERE collection='permutations' AND map_id='conjugate_after_cycle_type') || '|' ||
       bool_and(permutations__conjugate_after_cycle_type((e).value) = partition_conjugate(perm_cycle_type((e).value)))::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
   $q$),

  ('map_compose', 'M2 inverse_after_complement_after_reverse is a REAL base_map row, DEPTH 3, agreeing with directly nesting its three factors',
   'eq', 'permutations|true|true', 'codomain typing, agreement with hand-nested reverse/complement/inverse, and its declared is_bijection is true (all three factors were fixed above)',
   $q$
     SELECT (SELECT codomain FROM base_map WHERE collection='permutations' AND map_id='inverse_after_complement_after_reverse') || '|' ||
       bool_and(permutations__inverse_after_complement_after_reverse((e).value) = perm_inverse(perm_complement(perm_reverse((e).value))))::text || '|' ||
       (SELECT is_bijection FROM base_map WHERE collection='permutations' AND map_id='inverse_after_complement_after_reverse')::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
   $q$),

  ('map_compose', 'M2 also happens to be an involution (a bonus fact, not required to register it): applying it twice is the identity over permutations(0..6)',
   'eq', 'true', 'discovered while proving M2, not assumed',
   $q$
     SELECT bool_and(permutations__inverse_after_complement_after_reverse(permutations__inverse_after_complement_after_reverse((e).value)) = (e).value)::text
       FROM generate_series(0,6) n, LATERAL elements(permutations(n)) e
   $q$),

  ('map_compose', 'S1 longest_cycle_length is a REAL base_stat row, agreeing with directly nesting largest_part(cycle_type(p))',
   'eq', 'true', 'find_stat.sql already proves no depth-0 stat matches this — genuinely new, not a duplicate',
   $q$
     SELECT bool_and(permutations__longest_cycle_length((e).value) = partition_largest(perm_cycle_type((e).value)))::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
   $q$),

  ('map_compose', 'base_map_compound rows for permutations are all independently re-resolvable and agree on codomain (typing holds — a floor, not an exact count)',
   'eq', 'true', 'the view is just an index — map_compose_resolve is the source of truth',
   $q$ SELECT bool_and((map_compose_resolve(bc.domain, bc.map_path)).codomain = bc.codomain)::text
       FROM base_map_compound bc WHERE bc.domain = 'permutations' $q$),

  ('map_compose', 'the curated set is present as a floor in base_map (a materializer double-registration attempt raises, guarding against duplicates)',
   'eq', 'true|true', 'M1 and M2 are real rows now; re-materializing conjugate_after_cycle_type is refused',
   $q$
     SELECT (EXISTS (SELECT 1 FROM base_map WHERE collection='permutations' AND map_id='conjugate_after_cycle_type')
         AND EXISTS (SELECT 1 FROM base_map WHERE collection='permutations' AND map_id='inverse_after_complement_after_reverse'))::text
       || '|' ||
       base_raises($e$ SELECT map_compose_materialize('permutations', ARRAY['cycle_type','conjugate'], 'conjugate_after_cycle_type') $e$)::text
   $q$);

-- ── issue #220 chunk 3: name the inverse of every declared bijection ───────────────────────────────────────────
-- Five bijections had `inverse` NULL: the four carrier-scope involutions (reverse/complement/inverse on
-- permutations, conjugate on integer_partitions — each already proven f(f(x))=x, per-map, in maps.sql /
-- permutations.stats.sql) plus M2 (inverse_after_complement_after_reverse). An involution IS its own inverse, so
-- the first four just point at themselves. M2 is a genuine depth-3 composition, I∘C∘R (apply reverse, then
-- complement, then inverse); the group-theoretic inverse of that chain is R⁻¹∘C⁻¹∘I⁻¹ = R∘C∘I since all three
-- factors are self-inverse — i.e. "reverse_after_complement_after_inverse", a DIFFERENT map path in general. But
-- the example above ("M2 also happens to be an involution") already proves M2∘M2 = id over permutations(0..6): for
-- this particular trio, R∘C∘I and I∘C∘R coincide, so R∘C∘I names no new function — it's M2 itself under a
-- different path. Registering a second base_map row for it would be exactly the alias-not-duplication case this
-- file already guards against (reverse_complement, cycle_count); M2 points at itself instead.
UPDATE base_map SET inverse = map_id WHERE (collection, map_id) IN (
  ('permutations','reverse'), ('permutations','complement'), ('permutations','inverse'),
  ('integer_partitions','conjugate'), ('permutations','inverse_after_complement_after_reverse'));

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('maps','every declared bijection names its inverse map','eq','0','no bijection is missing its `inverse` pointer',$q$
    SELECT count(*)::text FROM base_map WHERE is_bijection AND inverse IS NULL $q$),
  ('maps','the four involutions point at themselves; M2 points at itself too (proven self-inverse above)','eq','true','inverse = map_id for all five',$q$
    SELECT bool_and(inverse = map_id)::text FROM base_map
     WHERE (collection, map_id) IN (('permutations','reverse'), ('permutations','complement'), ('permutations','inverse'),
                                     ('integer_partitions','conjugate'), ('permutations','inverse_after_complement_after_reverse')) $q$);
