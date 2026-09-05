-- requires: realizer
-- requires-tag: collection
-- Registration lint for the convention-discovered ranking/enumeration bindings (issue #49).
--
-- base_realize wires a collection's enumeration surface by DISCOVERING its per-collection engines BY CONVENTION —
-- it greps the realized function surface with to_regprocedure(<hook>(<coll>_fiber, …)). So a flat public name +
-- exact signature is load-bearing: rename the function, change its arg type, or shadow it with an overload and the
-- OPTIONAL accels (fiber_unrank / fiber_count / contains_in_fiber) are silently NOT wired — the collection quietly
-- loses direct-unrank / count / membership with no error, the very drop #49 warns about. This view surfaces the drop
-- as data (and, via the base_example below, as a FAILED assertion) instead of it vanishing silently.
--
-- Per collection it re-derives the exact signatures the realizer greps and classifies each hook:
--   missing   — the REQUIRED ordered floor fiber_elements(<coll>_fiber, int) is not discoverable (its enumeration —
--               hence every derived ranking — has no backing engine). This one is normally a LOUD load failure too
--               (base_realize references it unconditionally), so it's a belt-and-braces guard.
--   shadowed  — a hook of the right name exists ON THIS collection's fiber but NOT with the discovered signature
--               (e.g. fiber_unrank(<coll>_fiber, bigint) instead of rank_index): authored, silently dropped.
--   ambiguous — more than one candidate of that hook on the fiber, so which one drives the surface is a coin toss.
-- A clean catalog yields ZERO rows.
CREATE VIEW base_ranking_lint AS
WITH coll AS (
  -- a TRUE ALIAS (#101, base_collection.alias_of) deliberately has no own fiber/engine — it borrows the canonical's
  -- tower rather than minting a duplicate one — so it is out of scope for this lint by design, not a drop to catch.
  SELECT c.id, c.carrier, (c.id || '_fiber') AS fiber FROM base_collection c WHERE c.alias_of IS NULL
),
-- the convention hooks base_realize discovers, with the EXACT signature it greps (see realizer.sql). `required` marks
-- the ordered floor (the ranking's backing engine); the rest are opt-in accelerations.
spec AS (
            SELECT id, fiber, 'fiber_elements'    AS hook, format('fiber_elements(%I, integer)',    fiber)            AS sig, true  AS required FROM coll
  UNION ALL SELECT id, fiber, 'fiber_unrank',           format('fiber_unrank(%I, rank_index)',      fiber),                 false FROM coll
  UNION ALL SELECT id, fiber, 'fiber_count',            format('fiber_count(%I)',                   fiber),                 false FROM coll
  UNION ALL SELECT id, fiber, 'contains_in_fiber', format('contains_in_fiber(%I, %s)', fiber, carrier),                     false FROM coll
),
seen AS (
  SELECT s.*,
         to_regprocedure(s.sig) IS NOT NULL AS discovered,      -- resolves exactly as the realizer's grep does
         (SELECT count(*) FROM pg_proc p                        -- any function of that name ON THIS collection's fiber
            WHERE p.proname = s.hook AND p.pronargs >= 1
              AND p.proargtypes[0] = to_regtype(s.fiber)) AS authored
    FROM spec s
)
SELECT id AS collection, hook, sig,
       CASE WHEN required     AND NOT discovered            THEN 'missing'
            WHEN NOT required  AND authored > 0 AND NOT discovered THEN 'shadowed'
            ELSE 'ambiguous' END AS issue
  FROM seen
 WHERE (required     AND (NOT discovered OR authored > 1))
    OR (NOT required AND authored > 0 AND (NOT discovered OR authored > 1));

-- ── living assertions ────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('lint','every collection''s ranking binding is discoverable (no missing/shadowed/ambiguous convention hook)','eq','0',
   'base_ranking_lint is empty — no ranking silently dropped by a rename/signature drift/collision',
   $q$ SELECT count(*)::text FROM base_ranking_lint $q$),
  ('lint','the lint is non-vacuous: its discovery predicate agrees with the capability traits (fiber_unrank ⇔ indexable)','eq','true',
   'the exact-signature grep the lint uses matches what the trait layer sees — so a clean lint means real coverage',
   $q$ SELECT (
       (SELECT count(*) FROM base_collection WHERE to_regprocedure('fiber_unrank(' || id || '_fiber, rank_index)') IS NOT NULL)
       = (SELECT count(*) FROM base_collection_trait WHERE trait = 'indexable'))::text $q$);
