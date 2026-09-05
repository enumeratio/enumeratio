-- requires: grand_dyck_paths, dyck_paths.stats2, realizer, utilities
-- grand_dyck_paths statistics — NOT new registrations: grand_dyck_paths shares the dyck_path carrier with
-- dyck_paths, and base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed dyck_paths
-- stat here automatically (own=false) — adding explicit base_stat rows would be a harmful duplicate (see the
-- 'square_partitions inherits...' catalog invariant this exact mistake broke while drafting the partition-family
-- batch). This file is examples only, confirming the POSITIVITY-independent stats behave correctly on a path
-- that dips below the axis: peaks/valleys/double_rises/longest_ascent/longest_descent/returns/touch_points/
-- hills/initial_rise/major_index are well-defined on any ±1 word, and `height` (max prefix sum) stays ≥ 0 even
-- here — the free path still returns to 0, so some prefix sum is ≥ 0, hence so is the max. (`area`/`bounce`/
-- `dinv` DO also resolve here via the same carrier inheritance, but are semantically iffy on a dipping path —
-- area in particular can go negative — a pre-existing inheritance-model gap, out of scope to fix here.)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('grand_dyck_paths','the dyck_paths stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees height on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'grand_dyck_paths' AND stat_id = 'height' AND NOT own)::text $q$),
  ('grand_dyck_paths','height on DUUD (dips below the axis, n=2): height 1, and it is still ≥ 0','eq','1','free path that dips to -1 before recovering',$q$
    SELECT dyck_height(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text $q$),
  ('grand_dyck_paths','height is ≥ 0 over the entire grand_dyck_paths(3) floor, including dipping paths','eq','true','the return-to-0 argument holds for every free path',$q$
    SELECT bool_and(dyck_height((e).value) >= 0)::text FROM elements(grand_dyck_paths(3)) e $q$),
  ('grand_dyck_paths','returns over grand_dyck_paths(2): DUUD and UDUD both touch 0 twice (mid-path and at the end)','eq','2|2','#times the free path returns to height 0',$q$
    SELECT dyck_returns(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text || '|' ||
           dyck_returns(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text $q$),
  ('grand_dyck_paths','peaks/valleys over grand_dyck_paths(2): DUUD has 1 peak, 1 valley (interior UU→D and D→UU)','eq','1|1','a dipping path still has well-defined peaks/valleys',$q$
    SELECT dyck_peaks(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text || '|' ||
           dyck_valleys(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text $q$),
  ('grand_dyck_paths','peaks distribution over grand_dyck_paths(3) (20 free paths) sums to the total UD-factor count','eq','true','floor cross-check via SUM, not a memorized distribution',$q$
    SELECT (
      (SELECT sum(dyck_peaks((e).value)) FROM elements(grand_dyck_paths(3)) e)
      = (SELECT count(*) FROM elements(grand_dyck_paths(3)) e, generate_subscripts(((e).value).steps,1) i
         WHERE i < array_length(((e).value).steps,1) AND ((e).value).steps[i] = 1 AND ((e).value).steps[i+1] = -1)
    )::text $q$),
  ('grand_dyck_paths','touch_points/hills/initial_rise/major_index on DUUD (n=2, a dipping free path)','eq','3|1|0|3','touches 0 twice (returns) + the start = 3; the UD at positions 3-4 sits at height 0 (1 hill); opens with D (0 initial rise); one U-then-D peak at position 3',$q$
    SELECT dyck_touch_points(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text || '|' ||
           dyck_hills(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text || '|' ||
           dyck_initial_rise(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text || '|' ||
           dyck_major_index(ROW(ARRAY[-1,1,1,-1])::dyck_path)::text $q$);
