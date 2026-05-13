// Binomial z-score: how many SDs above expected does k primes-out-of-total
// sit, given the global density p?
export function zScore(observed: number, total: number, p: number): number {
  if (total === 0 || p === 0 || p === 1) return 0;
  const expected = total * p;
  const variance = total * p * (1 - p);
  if (variance <= 0) return 0;
  return (observed - expected) / Math.sqrt(variance);
}
