-- requires: subsets
-- power_set — the standard set-theory NAME for `subsets`: 2^[n], the set of all subsets of [n]. A TRUE alias (#101):
-- the SAME collection under a second, more familiar id — not an order-iso sibling (k_subsets, which refines by |S|,
-- is a genuinely distinct type and stays its own realized collection). Exercises the shared-tower mechanism end to
-- end: base_alias registers it without minting a duplicate subsets_fiber-shaped tower, and the explorer router
-- resolves /explore/collection/power_set to /explore/collection/subsets before the client ever touches it.
SELECT base_alias('power_set', 'subsets');
INSERT INTO base_collection_meta (collection, title, description) VALUES
  ('power_set', 'Power Set', 'Alias of Subsets — 2^[n], the set of all subsets of [n]. Same collection under its classical name.');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('alias', 'power_set is registered as an alias, mirroring subsets'' carrier/unbounded/grade chain', 'eq', 'finset|false|n',
   'base_alias copies just enough of the canonical row for base_catalog to list + describe the alias',
   $q$ SELECT c.carrier || '|' || c.unbounded::text || '|' || (SELECT string_agg(name, ',' ORDER BY pos) FROM base_grade WHERE collection = 'power_set')
       FROM base_collection c WHERE c.id = 'power_set' $q$),
  ('alias', 'power_set is NOT independently realized: no handle/fiber type or constructor exists for it', 'eq', 'true|true|true',
   'base_alias deliberately skips base_realize — no duplicate tower, per #101',
   $q$ SELECT (to_regtype('power_set') IS NULL)::text || '|' ||
              (to_regtype('power_set_fiber') IS NULL)::text || '|' ||
              (to_regprocedure('power_set()') IS NULL)::text $q$),
  ('alias', 'base_catalog surfaces alias_of, pointing power_set at its canonical subsets (and subsets itself is not aliased)', 'eq', 'subsets|NULL',
   'the column the explorer router resolves on',
   $q$ SELECT (SELECT alias_of FROM base_catalog WHERE id = 'power_set') || '|' ||
              (SELECT coalesce(alias_of, 'NULL') FROM base_catalog WHERE id = 'subsets') $q$),
  ('alias', 'aliasing power_set leaves subsets fully realized and untouched: cardinality(subsets(4)) = 16', 'eq', '16',
   'the canonical tower is unaffected by a later alias registration onto it',
   $q$ SELECT cardinality(subsets(4))::text $q$),
  ('alias', 'the ranking lint (every REALIZED collection has a discoverable floor) stays clean with an alias in the catalog', 'eq', '0',
   'power_set is deliberately excluded, not a drop the lint should flag (base_ranking_lint WHERE alias_of IS NULL)',
   $q$ SELECT count(*)::text FROM base_ranking_lint WHERE collection = 'power_set' $q$),
  ('alias', 'power_set carries none of the realization-derived traits (enumerable, finite) that subsets legitimately has', 'eq', '0',
   'base_collection_trait must not attribute an unrealized alias'' iterator/finiteness floor (#101 bug)',
   $q$ SELECT count(*)::text FROM base_collection_trait WHERE collection = 'power_set' AND trait IN ('enumerable', 'finite') $q$);
