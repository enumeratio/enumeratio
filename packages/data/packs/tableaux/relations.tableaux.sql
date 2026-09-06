-- requires: relations, maps-bijections.tableaux, standard_tableau_pairs.maps
-- tableaux half of sqlsrc/relations.sql's RSK check (#283 phase 3 lane 2 extraction) — split out because
-- base_relation is populated by core's relations.sql (a core-owned TABLE + one-shot INSERT…SELECT, re-derived
-- by base_relation_pack_finalize after every pack loads) and this pack only adds an example over the row that
-- INSERT already produced once BOTH directions exist: the forward row in maps-bijections.tableaux.sql, the
-- backward row in standard_tableau_pairs.maps.sql.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('relations','RSK is promoted with both directions named (#153): forward perm_rsk, backward the tableau-pair inverse','eq','permutations|standard_tableau_pairs|perm_rsk|standard_tableau_pair_to_perm|t|f','the reverse map is registered — no more carrier blocker',$q$
    SELECT domain||'|'||codomain||'|'||forward_fn||'|'||coalesce(backward_fn,'∅')||'|'||left(is_bijection::text,1)||'|'||left(is_order_iso::text,1)
      FROM base_relation WHERE forward_fn='perm_rsk' $q$);
