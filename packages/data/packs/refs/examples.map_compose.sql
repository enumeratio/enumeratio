-- requires: map_compose, find_stat
-- These `map_compose` examples exercise map_compose_over/map_compose_stat_over's find_stat_source-backed VIRTUAL
-- sweep (a bounded enumeration source owned by find_stat.sql) — split out of sqlsrc/map_compose.sql (#283 phase
-- 2.2) because that source only exists once this pack loads; map_compose.sql itself keeps the examples that
-- exercise the resolve/materialize path directly, with no find_stat dependency.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('map_compose', 'a depth-1 chain degrades to the map itself: composing [cycle_type] alone matches perm_cycle_type directly',
   'eq', 'true', 'sanity floor before testing real multi-hop chains',
   $q$
     WITH ct AS (SELECT * FROM map_compose_over('permutations', ARRAY['cycle_type'], 4, 200))
     SELECT bool_and(ct.codomain_render = render_value(perm_cycle_type((e).value)))::text
       FROM generate_series(0,4) n, LATERAL elements(permutations(n)) e
       JOIN ct ON ct.domain_render = render_value((e).value)
   $q$),
  ('map_compose', 'map_compose DERIVES the hand-rolled reverse_complement over permutations(0..5), either factor order — reconciled, not duplicated',
   'eq', 'true|true', 'composing [reverse,complement] and [complement,reverse] both agree with perm_reverse_complement element-for-element',
   $q$
     WITH rc AS (SELECT * FROM map_compose_over('permutations', ARRAY['reverse','complement'], 5, 200)),
          cr AS (SELECT * FROM map_compose_over('permutations', ARRAY['complement','reverse'], 5, 200))
     SELECT bool_and(rc.codomain_render = one_line(perm_reverse_complement((e).value)))::text || '|' ||
            bool_and(cr.codomain_render = one_line(perm_reverse_complement((e).value)))::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
       JOIN rc ON rc.domain_render = render_value((e).value)
       JOIN cr ON cr.domain_render = render_value((e).value)
   $q$),
  ('map_compose', 'the mechanism holds at genuine depth 3 for a STAT pullback too (not registered — a mechanism check): fixed_points∘[reverse,complement,inverse] agrees with hand-nesting',
   'eq', 'true', 'exercises depth>2 through map_compose_stat_over directly, same chain as M2 plus an existing stat — this compound is deliberately left unregistered (no independent meaning claimed for it)',
   $q$
     WITH fp AS (SELECT * FROM map_compose_stat_over('permutations', ARRAY['reverse','complement','inverse'], 'fixed_points', 5, 200))
     SELECT bool_and(fp.stat_value = perm_fixed_points(perm_inverse(perm_complement(perm_reverse((e).value))))::numeric)::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
       JOIN fp ON fp.domain_render = render_value((e).value)
   $q$),
  ('map_compose', 'S1 is reconciled with, not duplicating, the independently-registered cycle_count stat when composed one map deeper (cycle_type,conjugate→largest_part = perm_cycle_count)',
   'eq', 'true', 'the "great depth-2" compound from the design pass — proven, not re-registered, since cycle_count already names this quantity',
   $q$
     WITH nc AS (SELECT * FROM map_compose_stat_over('permutations', ARRAY['cycle_type','conjugate'], 'largest_part', 5, 200))
     SELECT bool_and(nc.stat_value = perm_cycle_count((e).value)::numeric)::text
       FROM generate_series(0,5) n, LATERAL elements(permutations(n)) e
       JOIN nc ON nc.domain_render = render_value((e).value)
   $q$);
