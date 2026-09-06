-- requires: representations, fib_strings, primitive_binary_strings, lyndon_words
-- words-plus half of sqlsrc/representations.sql's carrier-inherited (binary_words/digits, binary_words/dots)
-- examples (#283 phase 3 extraction) — these call fib_strings/primitive_binary_strings/lyndon_words directly
-- (or check base_repr_resolved against their collection ids), so they can't run loading core alone even though the
-- base_repr rows themselves are registered on the core carrier (binary_words).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('representations','the default (unicode) binary_word notation is unchanged: fib_strings(3) rank4 → 101 (bare digits)','eq','101','notation(binary_word) still bare concatenation',$q$
    SELECT notation((unrank(fib_strings(3), 4)).value) $q$),
  ('representations','the binary_words digits repr is CARRIER-inherited: primitive_binary_strings resolves it at unicode and latex','eq','true','base_repr_resolved carries the binary_words-registered repr to a carrier sibling',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'primitive_binary_strings' AND repr = 'digits' AND medium = 'unicode')
        AND EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'primitive_binary_strings' AND repr = 'digits' AND medium = 'latex'))::text $q$),
  ('representations','the dots repr is CARRIER-scoped: it inherits to a binary_word sibling (lyndon_words)','eq','true','carrier reprs reach every collection over the carrier',$q$
    SELECT (EXISTS (SELECT 1 FROM base_repr_resolved WHERE collection = 'lyndon_words' AND repr = 'dots'))::text $q$);
