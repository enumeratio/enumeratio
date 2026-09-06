-- requires: realizer
-- base_cumulative_of (#67 D1): the declared relation between a THRESHOLD family and the grade axis it thresholds.
-- A threshold family (k_free_integers, smooth_numbers, rough_numbers) is realized as a named param-restrict that
-- RE-RANKS the naturals — the fibers of the underlying stat (gpf, spf, Ω-exponent) each interleave in value order,
-- so the sublevel/superlevel set cannot be a fiber-then-rank of the graded naturals ("re-ranking earns a name").
-- But it IS the sublevel set of a real, recoverable stat, so we record that second reading here: the atlas can show
-- both "the k-smooth numbers" (a collection) and "gpf(n) <= k" (a downset of the gpf-graded naturals) without
-- needing the deferred ranged-axis binder. `stat` names the value function on the carrier; `op` is the threshold
-- sense against the family parameter `param` (n in the family iff stat(n) <op> <param-binding>). Documentary registry.
CREATE TABLE base_cumulative_of (
  collection text PRIMARY KEY REFERENCES base_collection,   -- the threshold family (k_free_integers, smooth_numbers, …)
  stat       text NOT NULL,                                 -- the value function on the carrier it thresholds (greatest_prime_factor, …)
  op         text NOT NULL,                                 -- the threshold sense: '<=', '>=', '<'
  param      text NOT NULL,                                 -- the family param the stat is compared against ('k')
  pack text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack);
CREATE TRIGGER base_cumulative_of_pack_guard BEFORE UPDATE OR DELETE ON base_cumulative_of FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('family_params','threshold families declare is_cumulative_of a recoverable stat (the second, downset reading)','ok',NULL,'#67 D1 — realized as a re-ranking restrict AND recorded as a sublevel set',$q$
    SELECT coalesce(bool_and(op IN ('<=','>=','<')), true) FROM base_cumulative_of $q$);
