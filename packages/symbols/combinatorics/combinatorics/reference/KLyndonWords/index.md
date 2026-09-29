---
name: KLyndonWords
domain: Collections
signature: KLyndonWords(n, k)
summary: "The Lyndon words of length $n$ over a $k$-letter alphabet: aperiodic necklaces, strictly less than every nontrivial rotation."
signatures:
  - call: KLyndonWords(n, k)
    description: "the Lyndon words of length $n$ over a $k$-letter alphabet: aperiodic necklaces, strictly less than every nontrivial rotation"
    library: enumeratio-combinatorics
    type: (integer<0..>, integer<0..>) -> indexed_collection<list<integer>>
seeAlso:
  - LyndonWords
  - KNecklaces
catalog:
  - system: sage
    identity: LyndonWords(n, k)
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/lyndon_word.html
    note: sage signature is (alphabet size, word length); matches our (base, size)
grades:
  - name: size
    role: axis
  - name: base
    role: param
carrier: Word
---

- Count is $\frac{1}{n}\sum_{d \mid n} \mu(d) \, k^{n/d}$; specializes to [[LyndonWords]] at $k=2$.
