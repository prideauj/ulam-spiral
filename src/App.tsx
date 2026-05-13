import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpiralCanvas, type PointHover } from './components/SpiralCanvas';
import { Controls, type ModeFlags } from './components/Controls';
import { Legend } from './components/Legend';
import { Tooltip } from './components/Tooltip';
import type {
  ComputeResult,
  LineStat,
  WorkerRequest,
  WorkerResponse,
} from './types';

const DEFAULT_N = 4;
const DEFAULT_MAX = 2000;

export function App() {
  const [n, setN] = useState(DEFAULT_N);
  const [maxN, setMaxN] = useState(DEFAULT_MAX);
  const [minLineLength, setMinLineLength] = useState(5);
  const [zThreshold, setZThreshold] = useState(1);
  const [mode, setMode] = useState<ModeFlags>({
    screen: true,
    armSide: false,
    armVertex: false,
  });
  const [topN, setTopN] = useState(10);
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [computing, setComputing] = useState(false);
  const [progress, setProgress] = useState({ stage: '', pct: 0 });
  const [error, setError] = useState<string | null>(null);

  const [hoveredLine, setHoveredLine] = useState<LineStat | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<PointHover | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [selectedLine, setSelectedLine] = useState<LineStat | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('./workers/compute.worker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress({ stage: msg.stage, pct: msg.pct });
      } else if (msg.type === 'done') {
        setResult(msg.result);
        setMaxN(msg.result.maxN);
        setN(msg.result.n);
        setHoveredLine(null);
        setSelectedLine(null);
        setComputing(false);
        setError(null);
      } else if (msg.type === 'error') {
        setError(msg.message);
        setComputing(false);
      }
    };
    worker.onerror = (e) => {
      // Surface worker load / runtime errors instead of hanging on "starting".
      console.error('Worker error', e);
      setError(e.message || 'Worker failed to load (see console).');
      setComputing(false);
    };
    workerRef.current = worker;

    // Kick off the initial compute against THIS worker. Doing it here (not
    // in a separate "first-mount-only" effect) ensures that under StrictMode's
    // double-mount, the freshly-created worker also receives a message.
    setComputing(true);
    setProgress({ stage: 'starting', pct: 0 });
    setError(null);
    const initial: WorkerRequest = {
      cmd: 'compute',
      n: DEFAULT_N,
      maxN: DEFAULT_MAX,
      minLineLength: 5,
    };
    worker.postMessage(initial);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const compute = useCallback(
    (nextN: number, nextMaxN: number) => {
      if (!workerRef.current) return;
      setComputing(true);
      setProgress({ stage: 'starting', pct: 0 });
      setError(null);
      const req: WorkerRequest = {
        cmd: 'compute',
        n: nextN,
        maxN: nextMaxN,
        minLineLength,
      };
      workerRef.current.postMessage(req);
    },
    [minLineLength]
  );

  const extend = useCallback(
    (newMaxN: number) => {
      if (!workerRef.current || !result) return;
      setComputing(true);
      setProgress({ stage: 'starting', pct: 0 });
      setError(null);
      const req: WorkerRequest = {
        cmd: 'extend',
        n: result.n,
        oldMaxN: result.maxN,
        newMaxN,
        minLineLength,
      };
      workerRef.current.postMessage(req);
    },
    [result, minLineLength]
  );

  // Filter lines by mode + threshold, then dedupe across overlapping
  // categories (e.g. for n=5 a horizontal line is detected by screen-h AND
  // arm-side[0] AND arm-vertex[2]; we keep the first occurrence). Finally
  // sort by z-score desc so the legend list and the canvas top-N agree.
  const filteredLines = useMemo<LineStat[]>(() => {
    if (!result) return [];
    const seen = new Set<string>();
    const out: LineStat[] = [];
    for (const l of result.lines) {
      if (l.zScore < zThreshold) continue;
      if (l.category === 'screen' && !mode.screen) continue;
      if (l.category === 'arm-side' && !mode.armSide) continue;
      if (l.category === 'arm-vertex' && !mode.armVertex) continue;
      const sig = l.pointIndices.join(',');
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(l);
    }
    out.sort((a, b) => b.zScore - a.zScore);
    return out;
  }, [result, zThreshold, mode]);

  // The canvas only draws the top-N matching the legend slider, so the overlay
  // and the legend list stay consistent.
  const canvasLines = useMemo<LineStat[]>(
    () => filteredLines.slice(0, topN),
    [filteredLines, topN]
  );

  const handleHover = useCallback(
    (
      line: LineStat | null,
      point: PointHover | null,
      clientX: number,
      clientY: number
    ) => {
      setHoveredLine(line);
      setHoveredPoint(point);
      setMousePos({ x: clientX, y: clientY });
    },
    []
  );

  return (
    <div className="app">
      <Controls
        n={n}
        maxN={maxN}
        zThreshold={zThreshold}
        minLineLength={minLineLength}
        mode={mode}
        computing={computing}
        hasData={!!result}
        onCompute={compute}
        onExtend={extend}
        onZThreshold={setZThreshold}
        onMinLineLength={setMinLineLength}
        onMode={setMode}
      />

      <div style={{ position: 'relative', minWidth: 0, minHeight: 0 }}>
        <SpiralCanvas
          positions={result?.positions ?? null}
          isPrime={result?.isPrime ?? null}
          lines={canvasLines}
          hoveredLineId={hoveredLine?.id ?? null}
          selectedLineId={selectedLine?.id ?? null}
          onHover={handleHover}
        />
        {result && (
          <div className="status-bar">
            n={result.n} · max N={result.maxN.toLocaleString()} · primes=
            {result.totalPrimes.toLocaleString()} · lines drawn=
            {canvasLines.length.toLocaleString()} of{' '}
            {filteredLines.length.toLocaleString()} above threshold
          </div>
        )}
        {computing && (
          <div className="progress">
            <div>{progress.stage}</div>
            <div className="bar">
              <div style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <Tooltip
          line={hoveredLine}
          point={hoveredPoint}
          x={mousePos.x}
          y={mousePos.y}
          globalDensity={result?.globalDensity ?? 0}
        />
      </div>

      <Legend
        lines={filteredLines}
        topN={topN}
        onTopN={setTopN}
        hoveredLineId={hoveredLine?.id ?? null}
        selectedLineId={selectedLine?.id ?? null}
        onHover={setHoveredLine}
        onSelect={setSelectedLine}
        globalDensity={result?.globalDensity ?? 0}
        totalPrimes={result?.totalPrimes ?? 0}
        maxN={result?.maxN ?? 0}
      />
    </div>
  );
}
