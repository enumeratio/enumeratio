/** 20-point Gauss–Legendre nodes and weights on [−1, 1], by Newton on P₂₀. */
export const GAUSS_LEGENDRE_20: { x: number[]; w: number[] } = (() => {
  const n = 20;
  const x: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p0 = 1;
      let p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (t * p1 - p0)) / (t * t - 1);
      const step = p1 / dp;
      t -= step;
      if (Math.abs(step) < 1e-16) break;
    }
    x.push(t);
    w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();
