---
head:
  - - meta
    - name: robots
      content: noindex
---

# Benchmarks

The same catalogue of cases, timed natively in enumeratio and in the systems the oracle checks
it against: Wolfram, mpmath, SymPy, Sage, Oscar, Julia and Rust. A system's time counts only
when its answer is right. Runs come from GitHub-hosted runners, so compare systems within a run
and trends within a job; the absolute numbers mean little. How it works:
[design/benchmarking.md](https://github.com/enumeratio/enumeratio/blob/main/design/benchmarking.md).

<ClientOnly>
<BenchViewer />
</ClientOnly>
