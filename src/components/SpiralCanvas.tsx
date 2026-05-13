import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LineStat } from '../types';

export interface PointHover {
  integer: number;
  isPrime: boolean;
}

interface Props {
  positions: Float32Array | null;
  isPrime: Uint8Array | null;
  lines: LineStat[];
  hoveredLineId: string | null;
  selectedLineId: string | null;
  onHover: (
    line: LineStat | null,
    point: PointHover | null,
    mouseClientX: number,
    mouseClientY: number
  ) => void;
}

const KIND_COLOR: Record<string, string> = {
  'screen-h': '#5b8def',
  'screen-v': '#5b8def',
  'screen-d1': '#a78bef',
  'screen-d2': '#a78bef',
  'arm-side': '#f0b46a',
  'arm-vertex': '#ef5bd6',
};

interface View {
  cx: number; // spiral coord at canvas center X
  cy: number; // spiral coord at canvas center Y
  ppu: number; // pixels per spiral unit
}

function distToSegmentSq(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = px - x1;
    const ey = py - y1;
    return ex * ex + ey * ey;
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  const ex = px - qx;
  const ey = py - qy;
  return ex * ex + ey * ey;
}

export function SpiralCanvas({
  positions,
  isPrime,
  lines,
  hoveredLineId,
  selectedLineId,
  onHover,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [view, setView] = useState<View | null>(null);

  // dragging state held in refs to avoid re-render storms
  const dragRef = useRef<{ x: number; y: number; cx: number; cy: number } | null>(
    null
  );

  // Spatial hash for fast point hit-testing. Bucket by unit cells in spiral
  // coords; spiral steps are unit-length so each cell holds only a handful of
  // points and we only check the 3x3 neighbourhood around the cursor.
  const pointIndex = useMemo(() => {
    const map = new Map<number, number[]>();
    if (!positions) return map;
    const count = positions.length / 2;
    for (let k = 1; k <= count; k++) {
      const x = positions[(k - 1) * 2];
      const y = positions[(k - 1) * 2 + 1];
      const key = ((Math.floor(x) + 32768) << 16) | (Math.floor(y) + 32768);
      const arr = map.get(key);
      if (arr) arr.push(k);
      else map.set(key, [k]);
    }
    return map;
  }, [positions]);

  // Bounding box of the spiral — reused for fit-to-view AND for extending
  // line endpoints across the full spiral.
  const bbox = useMemo(() => {
    if (!positions || positions.length === 0) return null;
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
  }, [positions]);

  // Fit view: refit when bbox changes (i.e. new spiral data), and once when
  // view is null (initial render). Subsequent size changes don't refit, so
  // user pan/zoom is preserved across window resizes.
  const lastBBoxRef = useRef<typeof bbox>(null);
  useEffect(() => {
    if (!bbox) return;
    if (size.w === 0 || size.h === 0) return;
    const bboxChanged = bbox !== lastBBoxRef.current;
    if (!bboxChanged && view) return;
    lastBBoxRef.current = bbox;
    const dx = Math.max(1, bbox.maxX - bbox.minX);
    const dy = Math.max(1, bbox.maxY - bbox.minY);
    const ppu = Math.min(size.w / dx, size.h / dy) * 0.9;
    setView({
      cx: (bbox.minX + bbox.maxX) / 2,
      cy: (bbox.minY + bbox.maxY) / 2,
      ppu,
    });
  }, [bbox, size, view]);

  // Sync-measure the wrap on mount so the initial fit uses the real container
  // size (not the default 800x600 placeholder). Subsequent resizes are picked
  // up by the ResizeObserver.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w > 0 && h > 0) setSize({ w, h });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Draw whenever data/view/size/highlights change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.w * dpr);
    canvas.height = Math.floor(size.h * dpr);
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    if (!positions || !isPrime) return;

    const halfW = size.w / 2;
    const halfH = size.h / 2;
    const toScreen = (sx: number, sy: number) => ({
      x: halfW + (sx - view.cx) * view.ppu,
      y: halfH - (sy - view.cy) * view.ppu,
    });

    const totalPoints = isPrime.length - 1;
    const dotMode = totalPoints > 5000 || view.ppu < 4;
    const drawLabels = view.ppu >= 14 && totalPoints <= 1000;

    // Points pass
    if (dotMode) {
      // Primes only, 1-2 px squares
      ctx.fillStyle = '#ef5b5b';
      const r = view.ppu < 2 ? 1 : 2;
      for (let k = 2; k <= totalPoints; k++) {
        if (!isPrime[k]) continue;
        const sx = positions[(k - 1) * 2];
        const sy = positions[(k - 1) * 2 + 1];
        const x = halfW + (sx - view.cx) * view.ppu;
        const y = halfH - (sy - view.cy) * view.ppu;
        if (x < -2 || x > size.w + 2 || y < -2 || y > size.h + 2) continue;
        ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
      // 1 is special — show it
      const one = toScreen(positions[0], positions[1]);
      ctx.fillStyle = '#7a8398';
      ctx.fillRect(one.x - r / 2, one.y - r / 2, r, r);
    } else {
      // Both primes and composites drawn as filled circles
      for (let k = 1; k <= totalPoints; k++) {
        const sx = positions[(k - 1) * 2];
        const sy = positions[(k - 1) * 2 + 1];
        const x = halfW + (sx - view.cx) * view.ppu;
        const y = halfH - (sy - view.cy) * view.ppu;
        if (x < -10 || x > size.w + 10 || y < -10 || y > size.h + 10) continue;
        const prime = isPrime[k] === 1;
        ctx.fillStyle = prime ? '#ef5b5b' : '#3a4252';
        ctx.beginPath();
        const r = prime ? 3 : 2;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (drawLabels) {
          ctx.fillStyle = prime ? '#ffe1e1' : '#7a8398';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(k), x + 4, y + 4);
        }
      }
    }

    // Lines pass — extend each line across the spiral bbox along its true
    // direction, then clip alpha by z-score.
    const bboxDiag = bbox
      ? Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY)
      : 0;
    for (const line of lines) {
      const ax = (line.x1 + line.x2) / 2;
      const ay = (line.y1 + line.y2) / 2;
      const ex1x = ax - line.dirX * bboxDiag;
      const ex1y = ay - line.dirY * bboxDiag;
      const ex2x = ax + line.dirX * bboxDiag;
      const ex2y = ay + line.dirY * bboxDiag;
      const p1 = toScreen(ex1x, ex1y);
      const p2 = toScreen(ex2x, ex2y);
      const isHovered = line.id === hoveredLineId;
      const isSelected = line.id === selectedLineId;
      const baseColor = KIND_COLOR[line.kind] ?? '#888';
      const z = Math.min(Math.max(line.zScore, 0), 4);
      let alpha = 0.2 + (z / 4) * 0.45;
      let width = 4;
      if (isHovered || isSelected) {
        alpha = 0.85;
        width = 7;
      }
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [positions, isPrime, lines, view, size, hoveredLineId, selectedLineId, bbox]);

  // Mouse handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!view) return;
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        cx: view.cx,
        cy: view.cy,
      };
    },
    [view]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!view) return;
      const drag = dragRef.current;
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        setView((v) =>
          v
            ? {
                ...v,
                cx: drag.cx - dx / v.ppu,
                cy: drag.cy + dy / v.ppu,
              }
            : v
        );
        return;
      }
      // hover hit-testing
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // mouse in spiral coords
      const sx = view.cx + (mx - size.w / 2) / view.ppu;
      const sy = view.cy - (my - size.h / 2) / view.ppu;

      // Point hit-testing first — a dot under the cursor wins over a line.
      let pointHit: PointHover | null = null;
      if (positions && isPrime) {
        // 8 px tolerance, bumped slightly so it's easy to grab at low zoom.
        const pointTol = 8 / view.ppu;
        const pointTol2 = pointTol * pointTol;
        const fx = Math.floor(sx);
        const fy = Math.floor(sy);
        let bestK = -1;
        let bestPd2 = Infinity;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const key = ((fx + dx + 32768) << 16) | (fy + dy + 32768);
            const arr = pointIndex.get(key);
            if (!arr) continue;
            for (const k of arr) {
              const px = positions[(k - 1) * 2];
              const py = positions[(k - 1) * 2 + 1];
              const ex = sx - px;
              const ey = sy - py;
              const d2 = ex * ex + ey * ey;
              if (d2 < bestPd2) {
                bestPd2 = d2;
                bestK = k;
              }
            }
          }
        }
        if (bestK > 0 && bestPd2 < pointTol2) {
          pointHit = { integer: bestK, isPrime: isPrime[bestK] === 1 };
        }
      }

      // Also line hit-test (don't early-return on point hit). Lines pass
      // through their integer points by construction, so a dot under the
      // cursor almost always sits on a line. Showing both lets the user see
      // the integer AND the line's stats/formula at once.
      const tol = 6 / view.ppu;
      const tol2 = tol * tol;
      const bboxDiag = bbox
        ? Math.hypot(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY)
        : 0;
      let best: LineStat | null = null;
      let bestD = Infinity;
      for (const line of lines) {
        const ax = (line.x1 + line.x2) / 2;
        const ay = (line.y1 + line.y2) / 2;
        const d2 = distToSegmentSq(
          sx,
          sy,
          ax - line.dirX * bboxDiag,
          ay - line.dirY * bboxDiag,
          ax + line.dirX * bboxDiag,
          ay + line.dirY * bboxDiag
        );
        if (d2 < tol2 && d2 < bestD) {
          bestD = d2;
          best = line;
        }
      }
      onHover(best, pointHit, e.clientX, e.clientY);
    },
    [view, size, lines, onHover, positions, isPrime, pointIndex, bbox]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      dragRef.current = null;
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!view) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // spiral coord at mouse
      const sx = view.cx + (mx - size.w / 2) / view.ppu;
      const sy = view.cy - (my - size.h / 2) / view.ppu;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newPpu = Math.max(0.2, Math.min(400, view.ppu * factor));
      // keep (sx, sy) under cursor: cx_new + (mx - W/2)/newPpu = sx
      const newCx = sx - (mx - size.w / 2) / newPpu;
      const newCy = sy + (my - size.h / 2) / newPpu;
      setView({ cx: newCx, cy: newCy, ppu: newPpu });
    },
    [view, size]
  );

  const onPointerLeave = useCallback(() => {
    dragRef.current = null;
    onHover(null, null, 0, 0);
  }, [onHover]);

  return (
    <div ref={wrapRef} className="canvas-wrap">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
      />
    </div>
  );
}
