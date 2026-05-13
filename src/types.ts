export type LineKind =
  | 'screen-h'
  | 'screen-v'
  | 'screen-d1'
  | 'screen-d2'
  | 'arm-side'
  | 'arm-vertex';

export type LineCategory = 'screen' | 'arm-side' | 'arm-vertex';

export interface LineStat {
  id: string;
  kind: LineKind;
  category: LineCategory;
  armIndex?: number;
  bucket: number;
  total: number;
  primeCount: number;
  density: number;
  zScore: number;
  // integers on this line (sorted ascending) — used for dedup across overlapping
  // line categories (e.g. screen-h vs arm-side[0] at angle 0°).
  pointIndices: number[];
  // Each geometric line has two halves split at projection=0 along the line
  // direction. Within each half integers grow monotonically with their
  // along-line position, so they fit a single quadratic k(n) = a*n^2+b*n+c.
  // Both halves are stored center-outward (closest-to-zero projection first).
  halfA: number[];
  halfB: number[];
  // endpoints in spiral coords: the min/max projection integers along the line
  // direction. SpiralCanvas extends these to the spiral bbox at draw time.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  // Line direction (unit-ish). Stored so the canvas can extend endpoints
  // along the true line direction even when only two points sit close together.
  dirX: number;
  dirY: number;
}

export interface ComputeResult {
  n: number;
  maxN: number;
  positions: Float32Array; // length 2*maxN, integer k (1..maxN) at index (k-1)*2
  isPrime: Uint8Array;     // length maxN+1
  totalPrimes: number;
  globalDensity: number;
  lines: LineStat[];
}

export type WorkerRequest =
  | { cmd: 'compute'; n: number; maxN: number; minLineLength: number }
  | { cmd: 'extend'; n: number; oldMaxN: number; newMaxN: number; minLineLength: number };

export type WorkerResponse =
  | { type: 'progress'; stage: string; pct: number }
  | { type: 'done'; result: ComputeResult }
  | { type: 'error'; message: string };
