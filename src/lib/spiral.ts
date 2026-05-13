// Generate spiral positions for an n-sided Ulam-style spiral.
//
// Generalisation: walk straight legs of growing length, turning by 2π/n
// between legs. Leg length grows by 1 every max(1, n-2) legs. This
// reproduces the classic Ulam square spiral for n=4 (1,1,2,2,3,3,...),
// and gives a non-self-intersecting spiral for n=3..20.
//
// Integer k (1..maxN) is placed at positions[(k-1)*2], positions[(k-1)*2 + 1].

export function generateSpiral(n: number, maxN: number): Float32Array {
  const positions = new Float32Array(maxN * 2);
  // integer 1 at origin
  positions[0] = 0;
  positions[1] = 0;
  if (maxN < 2) return positions;

  const grow = Math.max(1, n - 2);
  const twoPiOverN = (2 * Math.PI) / n;

  let x = 0;
  let y = 0;
  let direction = 0;
  let legIndex = 0;
  let k = 1; // next integer index to write (0-based), so integer (k+1)

  while (k < maxN) {
    const legLength = Math.floor(legIndex / grow) + 1;
    const angle = direction * twoPiOverN;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let s = 0; s < legLength && k < maxN; s++) {
      x += dx;
      y += dy;
      positions[k * 2] = x;
      positions[k * 2 + 1] = y;
      k++;
    }
    direction = (direction + 1) % n;
    legIndex++;
  }
  return positions;
}

// Extend an existing positions array. Reconstructs leg-walk state by replaying
// from the start (cheap relative to the analysis pass) and continues from oldMaxN.
export function extendSpiral(
  n: number,
  oldPositions: Float32Array,
  oldMaxN: number,
  newMaxN: number
): Float32Array {
  if (newMaxN <= oldMaxN) return oldPositions;
  const positions = new Float32Array(newMaxN * 2);
  positions.set(oldPositions);

  const grow = Math.max(1, n - 2);
  const twoPiOverN = (2 * Math.PI) / n;

  // Replay leg state up to oldMaxN.
  let direction = 0;
  let legIndex = 0;
  let placed = 1; // integer 1 already at origin
  while (placed < oldMaxN) {
    const legLength = Math.floor(legIndex / grow) + 1;
    const take = Math.min(legLength, oldMaxN - placed);
    placed += take;
    if (take < legLength) {
      // mid-leg break: we'll continue this leg below with remaining steps
      const remaining = legLength - take;
      const angle = direction * twoPiOverN;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      let x = oldPositions[(placed - 1) * 2];
      let y = oldPositions[(placed - 1) * 2 + 1];
      let k = placed;
      for (let s = 0; s < remaining && k < newMaxN; s++) {
        x += dx;
        y += dy;
        positions[k * 2] = x;
        positions[k * 2 + 1] = y;
        k++;
      }
      placed = k;
      direction = (direction + 1) % n;
      legIndex++;
      // continue main loop
      let cx = x;
      let cy = y;
      while (k < newMaxN) {
        const ll = Math.floor(legIndex / grow) + 1;
        const a = direction * twoPiOverN;
        const ddx = Math.cos(a);
        const ddy = Math.sin(a);
        for (let s = 0; s < ll && k < newMaxN; s++) {
          cx += ddx;
          cy += ddy;
          positions[k * 2] = cx;
          positions[k * 2 + 1] = cy;
          k++;
        }
        direction = (direction + 1) % n;
        legIndex++;
      }
      return positions;
    }
    direction = (direction + 1) % n;
    legIndex++;
  }

  // No mid-leg break: continue cleanly from oldMaxN.
  let x = oldPositions[(oldMaxN - 1) * 2];
  let y = oldPositions[(oldMaxN - 1) * 2 + 1];
  let k = oldMaxN;
  while (k < newMaxN) {
    const ll = Math.floor(legIndex / grow) + 1;
    const a = direction * twoPiOverN;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    for (let s = 0; s < ll && k < newMaxN; s++) {
      x += dx;
      y += dy;
      positions[k * 2] = x;
      positions[k * 2 + 1] = y;
      k++;
    }
    direction = (direction + 1) % n;
    legIndex++;
  }
  return positions;
}

export function boundingBox(positions: Float32Array): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 2) {
    const x = positions[i];
    const y = positions[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
