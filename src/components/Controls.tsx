import { useState } from 'react';

export interface ModeFlags {
  screen: boolean;
  armSide: boolean;
  armVertex: boolean;
}

interface Props {
  n: number;
  maxN: number;
  zThreshold: number;
  minLineLength: number;
  mode: ModeFlags;
  computing: boolean;
  hasData: boolean;
  onCompute: (n: number, maxN: number) => void;
  onExtend: (newMaxN: number) => void;
  onZThreshold: (z: number) => void;
  onMinLineLength: (n: number) => void;
  onMode: (m: ModeFlags) => void;
}

export function Controls({
  n,
  maxN,
  zThreshold,
  minLineLength,
  mode,
  computing,
  hasData,
  onCompute,
  onExtend,
  onZThreshold,
  onMinLineLength,
  onMode,
}: Props) {
  const [nInput, setNInput] = useState(n);
  const [maxInput, setMaxInput] = useState(maxN);
  const [extendInput, setExtendInput] = useState(maxN * 2);

  return (
    <div className="panel">
      <h2>Spiral</h2>
      <div className="field">
        <label>Sides (n): {nInput}</label>
        <input
          type="range"
          min={3}
          max={20}
          step={1}
          value={nInput}
          onChange={(e) => setNInput(Number(e.target.value))}
        />
      </div>
      <div className="field">
        <label>Max N</label>
        <input
          type="number"
          min={50}
          max={1_000_000}
          step={50}
          value={maxInput}
          onChange={(e) => setMaxInput(Number(e.target.value))}
        />
      </div>
      <button
        disabled={computing}
        onClick={() => onCompute(nInput, maxInput)}
        style={{ width: '100%', marginBottom: '0.5rem' }}
      >
        {computing ? 'Computing…' : hasData ? 'Recompute' : 'Render spiral'}
      </button>

      {hasData && (
        <>
          <h2 style={{ marginTop: '1rem' }}>Extend</h2>
          <div className="field">
            <label>New max N (must be &gt; current {maxN.toLocaleString()})</label>
            <input
              type="number"
              min={maxN + 1}
              max={1_000_000}
              step={50}
              value={extendInput}
              onChange={(e) => setExtendInput(Number(e.target.value))}
            />
          </div>
          <button
            disabled={computing || extendInput <= maxN}
            onClick={() => onExtend(extendInput)}
            style={{ width: '100%' }}
          >
            Extend to {extendInput.toLocaleString()}
          </button>
        </>
      )}

      <h2 style={{ marginTop: '1rem' }}>Line overlay</h2>
      <label className="toggle">
        <input
          type="checkbox"
          checked={mode.screen}
          onChange={(e) => onMode({ ...mode, screen: e.target.checked })}
        />
        Screen H / V / diagonal
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={mode.armSide}
          onChange={(e) => onMode({ ...mode, armSide: e.target.checked })}
        />
        Arm-side ({n} directions)
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={mode.armVertex}
          onChange={(e) => onMode({ ...mode, armVertex: e.target.checked })}
        />
        Arm-vertex ({n} directions, ½-step rotated)
      </label>

      <div className="field" style={{ marginTop: '1rem' }}>
        <label>Z-score threshold: {zThreshold.toFixed(2)}</label>
        <input
          type="range"
          min={0}
          max={6}
          step={0.05}
          value={zThreshold}
          onChange={(e) => onZThreshold(Number(e.target.value))}
        />
        <div className="muted">
          Higher = stricter ("more above average"). 2.0 ≈ ~2σ above mean.
        </div>
      </div>

      <div className="field">
        <label>Min line length: {minLineLength}</label>
        <input
          type="range"
          min={3}
          max={30}
          step={1}
          value={minLineLength}
          onChange={(e) => onMinLineLength(Number(e.target.value))}
        />
        <div className="muted">
          Lines with fewer points are ignored (changing this requires recompute).
        </div>
      </div>
    </div>
  );
}
