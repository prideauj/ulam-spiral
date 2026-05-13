import type { LineStat } from '../types';

const KIND_COLOR: Record<string, string> = {
  'screen-h': '#5b8def',
  'screen-v': '#5b8def',
  'screen-d1': '#a78bef',
  'screen-d2': '#a78bef',
  'arm-side': '#f0b46a',
  'arm-vertex': '#ef5bd6',
};

const KIND_LABEL: Record<string, string> = {
  'screen-h': 'horizontal',
  'screen-v': 'vertical',
  'screen-d1': 'diag (↗)',
  'screen-d2': 'diag (↘)',
  'arm-side': 'arm-side',
  'arm-vertex': 'arm-vertex',
};

interface Props {
  lines: LineStat[];
  topN: number;
  onTopN: (n: number) => void;
  hoveredLineId: string | null;
  selectedLineId: string | null;
  onHover: (line: LineStat | null) => void;
  onSelect: (line: LineStat | null) => void;
  globalDensity: number;
  totalPrimes: number;
  maxN: number;
}

export function Legend({
  lines,
  topN,
  onTopN,
  hoveredLineId,
  selectedLineId,
  onHover,
  onSelect,
  globalDensity,
  totalPrimes,
  maxN,
}: Props) {
  const top = [...lines]
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, topN);

  return (
    <div className="panel right">
      <h2>Global stats</h2>
      <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">N</span>
          <span>{maxN.toLocaleString()}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Total primes</span>
          <span>{totalPrimes.toLocaleString()}</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Density π(N)/N</span>
          <span>{(globalDensity * 100).toFixed(2)}%</span>
        </div>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Lines passing filter</span>
          <span>{lines.length.toLocaleString()}</span>
        </div>
      </div>

      <h2>Top prime-rich lines</h2>
      <div className="field">
        <label>Show top: {topN}</label>
        <input
          type="range"
          min={5}
          max={50}
          step={1}
          value={topN}
          onChange={(e) => onTopN(Number(e.target.value))}
        />
      </div>

      {top.length === 0 && (
        <div className="muted">
          No lines pass the current filter. Lower the z-threshold or enable
          more overlay modes.
        </div>
      )}
      <ul className="legend-list">
        {top.map((line) => (
          <li
            key={line.id}
            className={
              line.id === hoveredLineId || line.id === selectedLineId
                ? 'hovered'
                : ''
            }
            onMouseEnter={() => onHover(line)}
            onMouseLeave={() => onHover(null)}
            onClick={() =>
              onSelect(line.id === selectedLineId ? null : line)
            }
          >
            <span
              className="swatch"
              style={{ background: KIND_COLOR[line.kind] }}
            />
            <span className="meta">
              <span className="label">
                {KIND_LABEL[line.kind]}
                {line.armIndex !== undefined
                  ? ` #${line.armIndex}`
                  : ''}
              </span>
              <span className="stats">
                {line.primeCount}/{line.total} primes ·{' '}
                {(line.density * 100).toFixed(1)}%
              </span>
            </span>
            <span className="z">z={line.zScore.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
