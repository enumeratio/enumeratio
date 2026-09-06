-- requires: set_builders, compositions_into_k_parts
-- compositions-plus half of sqlsrc/set_builders.sql's k-graded composition example (#283 phase 3 extraction) —
-- split out because it calls compositions_into_k_parts(), a pack-owned collection's constructor, directly.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_builders','composition set-builder, k-graded: compositions_into_k_parts(5,2)','eq','\{\, \text{compositions of } 5 \text{ into } 2 \text{ parts} \,\}','extra axis spelled out, not folded generic',$q$
    SELECT set_builder((unrank(compositions_into_k_parts(5,2), 0)).fiber) $q$);
