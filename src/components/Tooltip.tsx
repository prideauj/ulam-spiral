import { useMemo } from 'react';
import type { LineStat } from '../types';
import type { PointHover } from './SpiralCanvas';
import { fitQuadratic, formatPolynomial } from '../lib/formula';

interface Props {
  line: LineStat | null;
  point: PointHover | null;
  x: number;
  y: number;
  globalDensity: number;
}

const KIND_LABEL: Record<string, string> = {
  'screen-h': 'horizontal',
  'screen-v': 'vertical',
  'screen-d1': 'diagonal (↗)',
  'screen-d2': 'diagonal (↘)',
  'arm-side': 'arm-side',
  'arm-vertex': 'arm-vertex',
};

export function Tooltip({ line, point, x, y, globalDensity }: Props) {
  // Fit a quadratic to the line's integers — same line each render, only refit
  // when the line changes.
  const fit = useMemo(() => (line ? fitQuadratic(line.pointIndices) : null), [line]);


  if (point) {
    return (
      <div
        className="tooltip"
        style={{
          left: x + 14,
          top: y + 14,
        }}
      >
        <div className="tt-title">{point.integer.toLocaleString()}</div>
        <div className="tt-row">
          <span className="k">Type</span>
          <span style={{ color: point.isPrime ? '#ef5b5b' : '#a0a7b8' }}>
            {point.isPrime ? 'prime' : 'composite'}
          </span>
        </div>
      </div>
    );
  }
  if (!line) return null;
  const lineP = line.density;
  const ratio = globalDensity > 0 ? lineP / globalDensity : 0;
  return (
    <div
      className="tooltip"
      style={{
        left: x + 14,
        top: y + 14,
      }}
    >
      <div className="tt-title">
        {KIND_LABEL[line.kind]}
        {line.armIndex !== undefined ? ` #${line.armIndex}` : ''}
      </div>
      <div className="tt-row">
        <span className="k">Points on line</span>
        <span>{line.total}</span>
      </div>
      <div className="tt-row">
        <span className="k">Primes</span>
        <span>{line.primeCount}</span>
      </div>
      <div className="tt-row">
        <span className="k">P(prime | on line)</span>
        <span>{(lineP * 100).toFixed(2)}%</span>
      </div>
      <div className="tt-row">
        <span className="k">P(prime | random)</span>
        <span>{(globalDensity * 100).toFixed(2)}%</span>
      </div>
      <div className="tt-row">
        <span className="k">Ratio</span>
        <span>{ratio.toFixed(2)}×</span>
      </div>
      <div className="tt-row">
        <span className="k">Z-score</span>
        <span>{line.zScore.toFixed(2)}</span>
      </div>
      {fit && (
        <div className="tt-row" style={{ marginTop: '0.3rem' }}>
          <span className="k">k(n) =</span>
          <span style={{ color: '#f0b46a', fontFamily: 'monospace' }}>
            {formatPolynomial(fit)}
          </span>
        </div>
      )}
    </div>
  );
}
