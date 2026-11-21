/**
 * Finding a rank by searching a collection's k-th members. The members of a row that states its
 * k-th member increase, so the search gallops (1, 2, 4, …) to a member past the target, then
 * bisects the last doubling: its evaluations grow with the logarithm of the rank, not the rank.
 * It stops at a cap on evaluations and a cap on wall time; past either the rank is "not computed"
 * and the page goes on. Pure: the page gives it the question, so a test can give it a fake one.
 */

/**
 * The most k-th members one search asks for. A rank is a JavaScript integer, at most 2^53, and
 * a search for the largest of them gallops 53 doublings and bisects 53 halvings: 108 asks; this
 * is a little above, so a cap never cuts off a rank that a number can name. The fixed cases need
 * far fewer: the natural 1000000000 takes 60 asks and the prime 999999937 (rank 50847534) 51.
 */
export const rankSearchEvaluations = 128;

/**
 * How long one search may run, in milliseconds, checked between asks. The case that needs it
 * is a prime near 10^13: its rank is near 4 × 10^11, `NthPrime` there takes seconds for each ask
 * (it takes 0.4 s at a rank of 10^10), and the search asks about 80 times, so the evaluations
 * cap is never the one reached. A single ask ends at the kernel's own limit (`askTimeMs`), so a
 * search lasts at most this long plus one ask.
 */
export const rankSearchTimeMs = 10000;

export interface RankSearchLimits {
  evaluations: number;
  timeMs: number;
  /** The clock, in milliseconds. */
  now: () => number;
}

export const defaultLimits: RankSearchLimits = {
  evaluations: rankSearchEvaluations,
  timeMs: rankSearchTimeMs,
  now: Date.now,
};

export interface RankSearch {
  /** The rank (from 1) of the target, when it is a member. */
  rank?: number;
  /** Why there is no rank. */
  reason?: string;
  /** How many members were asked for. */
  evaluations: number;
}

class Stopped extends Error {}

/**
 * The rank of `target` among members `at(1) < at(2) < …`. `at` answers undefined when the kernel
 * declines a member. A target that is not a member (between two members, below the first)
 * ends with no rank, as does one past a cap.
 */
export async function searchRank(
  at: (rank: number) => Promise<number | undefined>,
  target: number,
  limits: RankSearchLimits = defaultLimits,
): Promise<RankSearch> {
  const start = limits.now();
  const seen = new Map<number, number | undefined>();
  let evaluations = 0;
  const member = async (rank: number): Promise<number> => {
    if (!seen.has(rank)) {
      if (evaluations >= limits.evaluations) {
        throw new Stopped(`the search passed its ${limits.evaluations} asks`);
      }
      if (limits.now() - start > limits.timeMs) {
        throw new Stopped(`the search passed its ${limits.timeMs} ms`);
      }
      evaluations++;
      seen.set(rank, await at(rank));
    }
    const value = seen.get(rank);
    if (value === undefined) throw new Stopped('the kernel declines a member');
    return value;
  };
  try {
    let low = 1;
    let high = 1;
    let found = await member(high);
    while (found < target) {
      if (high > Number.MAX_SAFE_INTEGER / 2) throw new Stopped('the rank is beyond an integer');
      low = high + 1;
      high *= 2;
      found = await member(high);
    }
    if (found === target) return { rank: high, evaluations };
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      const value = await member(middle);
      if (value === target) return { rank: middle, evaluations };
      if (value < target) low = middle + 1;
      else high = middle;
    }
    return { reason: 'It is not a member.', evaluations };
  } catch (error) {
    if (error instanceof Stopped) return { reason: error.message, evaluations };
    throw error;
  }
}
