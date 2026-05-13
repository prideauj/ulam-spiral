import type { LineCategory, LineKind, LineStat } from '../types';
import { zScore } from './stats';

// Quantization factor for bucketing floating-point coordinates. Spiral steps
// are unit-length, so 4 decimal places is well below any meaningful spacing
// while tolerating floating-point drift across ~1M cos/sin sums.
const QUANT = 1e4;

// For each candidate bucket (a line), accumulate integer indices in order.
// Then compute prime count, density, z-score, and the line's screen endpoints.
export function analyseLines(
  positions: Float32Array,
  isPrime: Uint8Array,
  n: number,
  globalDensity: number,
  minLength: number
): LineStat[] {
  const totalPoints = isPrime.length - 1; // ints 1..N
  if (totalPoints < minLength) return [];

  // 4 screen axes: H (key y), V (key x), D1 (key x+y), D2 (key x-y)
  const screenH = new Map<number, number[]>();
  const screenV = new Map<number, number[]>();
  const screenD1 = new Map<number, number[]>();
  const screenD2 = new Map<number, number[]>();

  // n arm-side directions, n arm-vertex directions.
  // For each direction θ, line membership ≡ same perpendicular projection
  // onto (-sin θ, cos θ). Bucket by that.
  const armSide: Map<number, number[]>[] = [];
  const armVertex: Map<number, number[]>[] = [];
  const perpSide: { px: number; py: number; dx: number; dy: number }[] = [];
  const perpVertex: { px: number; py: number; dx: number; dy: number }[] = [];
  const twoPiOverN = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    armSide.push(new Map());
    armVertex.push(new Map());
    const aSide = i * twoPiOverN;
    const aVert = (i + 0.5) * twoPiOverN;
    perpSide.push({
      px: -Math.sin(aSide),
      py: Math.cos(aSide),
      dx: Math.cos(aSide),
      dy: Math.sin(aSide),
    });
    perpVertex.push({
      px: -Math.sin(aVert),
      py: Math.cos(aVert),
      dx: Math.cos(aVert),
      dy: Math.sin(aVert),
    });
  }

  const push = (m: Map<number, number[]>, key: number, integer: number) => {
    const arr = m.get(key);
    if (arr) arr.push(integer);
    else m.set(key, [integer]);
  };

  for (let idx = 0; idx < totalPoints; idx++) {
    const x = positions[idx * 2];
    const y = positions[idx * 2 + 1];
    const integer = idx + 1;

    push(screenH, Math.round(y * QUANT), integer);
    push(screenV, Math.round(x * QUANT), integer);
    push(screenD1, Math.round((x + y) * QUANT), integer);
    push(screenD2, Math.round((x - y) * QUANT), integer);

    for (let i = 0; i < n; i++) {
      const ps = perpSide[i];
      push(armSide[i], Math.round((x * ps.px + y * ps.py) * QUANT), integer);
      const pv = perpVertex[i];
      push(armVertex[i], Math.round((x * pv.px + y * pv.py) * QUANT), integer);
    }
  }

  const out: LineStat[] = [];
  let serial = 0;

  const collect = (
    buckets: Map<number, number[]>,
    kind: LineKind,
    category: LineCategory,
    dirX: number,
    dirY: number,
    armIndex?: number
  ) => {
    for (const [bucket, ints] of buckets) {
      if (ints.length < minLength) continue;
      // count primes
      let primes = 0;
      for (let i = 0; i < ints.length; i++) if (isPrime[ints[i]]) primes++;
      const total = ints.length;
      const density = primes / total;
      const z = zScore(primes, total, globalDensity);
      // endpoints: min/max projection along (dirX,dirY)
      let minProj = Infinity;
      let maxProj = -Infinity;
      let minK = ints[0];
      let maxK = ints[0];
      for (let i = 0; i < ints.length; i++) {
        const k = ints[i];
        const x = positions[(k - 1) * 2];
        const y = positions[(k - 1) * 2 + 1];
        const proj = x * dirX + y * dirY;
        if (proj < minProj) {
          minProj = proj;
          minK = k;
        }
        if (proj > maxProj) {
          maxProj = proj;
          maxK = k;
        }
      }
      // Sort ints ascending so dedup signatures are canonical regardless
      // of which direction (θ vs θ+180°) discovered the line.
      const sortedInts = ints.slice().sort((a, b) => a - b);
      // Normalize line direction to a unit vector — used by the renderer to
      // extend the line across the spiral bbox.
      const dlen = Math.hypot(dirX, dirY) || 1;
      out.push({
        id: `${kind}-${armIndex ?? 'na'}-${bucket}-${serial++}`,
        kind,
        category,
        armIndex,
        bucket: bucket / QUANT,
        total,
        primeCount: primes,
        density,
        zScore: z,
        pointIndices: sortedInts,
        x1: positions[(minK - 1) * 2],
        y1: positions[(minK - 1) * 2 + 1],
        x2: positions[(maxK - 1) * 2],
        y2: positions[(maxK - 1) * 2 + 1],
        dirX: dirX / dlen,
        dirY: dirY / dlen,
      });
    }
  };

  collect(screenH, 'screen-h', 'screen', 1, 0);
  collect(screenV, 'screen-v', 'screen', 0, 1);
  collect(screenD1, 'screen-d1', 'screen', 1, -1);
  collect(screenD2, 'screen-d2', 'screen', 1, 1);
  for (let i = 0; i < n; i++) {
    const ps = perpSide[i];
    collect(armSide[i], 'arm-side', 'arm-side', ps.dx, ps.dy, i);
    const pv = perpVertex[i];
    collect(armVertex[i], 'arm-vertex', 'arm-vertex', pv.dx, pv.dy, i);
  }

  return out;
}
