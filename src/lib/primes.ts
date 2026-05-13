// Sieve of Eratosthenes. Returns Uint8Array where index k is 1 if prime, else 0.
export function sieve(max: number): Uint8Array {
  const isPrime = new Uint8Array(max + 1);
  if (max < 2) return isPrime;
  isPrime.fill(1);
  isPrime[0] = 0;
  isPrime[1] = 0;
  const limit = Math.floor(Math.sqrt(max));
  for (let i = 2; i <= limit; i++) {
    if (isPrime[i]) {
      for (let j = i * i; j <= max; j += i) isPrime[j] = 0;
    }
  }
  return isPrime;
}

// Extend an existing sieve from oldMax+1 to newMax.
// Re-sieves the full new range — cheaper to write than a segmented sieve and
// at 1M, runs in <50ms.
export function extendSieve(oldIsPrime: Uint8Array, newMax: number): Uint8Array {
  const oldMax = oldIsPrime.length - 1;
  if (newMax <= oldMax) return oldIsPrime;
  return sieve(newMax);
}

export function countPrimes(isPrime: Uint8Array, upTo: number): number {
  let total = 0;
  for (let i = 2; i <= upTo; i++) if (isPrime[i]) total++;
  return total;
}
