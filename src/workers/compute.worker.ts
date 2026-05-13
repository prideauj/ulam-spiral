/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse, ComputeResult } from '../types';
import { generateSpiral, extendSpiral } from '../lib/spiral';
import { sieve, extendSieve, countPrimes } from '../lib/primes';
import { analyseLines } from '../lib/lines';

const ctx = self as DedicatedWorkerGlobalScope;

// Persist last-completed state in the worker so 'extend' can reuse it.
let lastN: number | null = null;
let lastMaxN = 0;
let lastPositions: Float32Array | null = null;
let lastIsPrime: Uint8Array | null = null;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

function compute(n: number, maxN: number, minLineLength: number): ComputeResult {
  post({ type: 'progress', stage: 'sieving primes', pct: 0 });
  const isPrime = sieve(maxN);
  post({ type: 'progress', stage: 'generating spiral', pct: 33 });
  const positions = generateSpiral(n, maxN);
  post({ type: 'progress', stage: 'analysing lines', pct: 66 });
  const totalPrimes = countPrimes(isPrime, maxN);
  const globalDensity = totalPrimes / maxN;
  const lines = analyseLines(positions, isPrime, n, globalDensity, minLineLength);
  post({ type: 'progress', stage: 'done', pct: 100 });

  lastN = n;
  lastMaxN = maxN;
  lastPositions = positions;
  lastIsPrime = isPrime;

  return { n, maxN, positions, isPrime, totalPrimes, globalDensity, lines };
}

function extend(
  n: number,
  oldMaxN: number,
  newMaxN: number,
  minLineLength: number
): ComputeResult {
  // If cached state doesn't match, fall back to full compute.
  if (lastN !== n || lastMaxN !== oldMaxN || !lastPositions || !lastIsPrime) {
    return compute(n, newMaxN, minLineLength);
  }
  post({ type: 'progress', stage: 'extending sieve', pct: 0 });
  const isPrime = extendSieve(lastIsPrime, newMaxN);
  post({ type: 'progress', stage: 'extending spiral', pct: 33 });
  const positions = extendSpiral(n, lastPositions, oldMaxN, newMaxN);
  post({ type: 'progress', stage: 'analysing lines', pct: 66 });
  const totalPrimes = countPrimes(isPrime, newMaxN);
  const globalDensity = totalPrimes / newMaxN;
  const lines = analyseLines(positions, isPrime, n, globalDensity, minLineLength);
  post({ type: 'progress', stage: 'done', pct: 100 });

  lastN = n;
  lastMaxN = newMaxN;
  lastPositions = positions;
  lastIsPrime = isPrime;

  return {
    n,
    maxN: newMaxN,
    positions,
    isPrime,
    totalPrimes,
    globalDensity,
    lines,
  };
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  try {
    const req = e.data;
    let result: ComputeResult;
    if (req.cmd === 'compute') {
      result = compute(req.n, req.maxN, req.minLineLength);
    } else {
      result = extend(req.n, req.oldMaxN, req.newMaxN, req.minLineLength);
    }
    post({ type: 'done', result });
  } catch (err) {
    post({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
