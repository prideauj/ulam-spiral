// Fit and pretty-print the quadratic k(n) = a*n^2 + b*n + c that generates the
// integers along a single line of the spiral.
//
// Integers on any line of the square Ulam spiral have constant second
// differences (the spiral's leg lengths grow linearly, so positions along a
// fixed direction grow quadratically). For non-square spirals this isn't
// always exact, but when it is the algorithm reports the polynomial; when it
// isn't, it returns null.

export interface QuadFit {
  a: number;
  b: number;
  c: number;
}

export function fitQuadratic(points: number[]): QuadFit | null {
  if (points.length === 0) return null;
  if (points.length === 1) return { a: 0, b: 0, c: points[0] };
  if (points.length === 2) {
    return { a: 0, b: points[1] - points[0], c: points[0] };
  }
  const target = points[2] - 2 * points[1] + points[0];
  for (let i = 3; i < points.length; i++) {
    const d = points[i] - 2 * points[i - 1] + points[i - 2];
    if (d !== target) return null;
  }
  const a = target / 2;
  const c = points[0];
  const b = points[1] - a - c;
  return { a, b, c };
}

function fmtCoef(v: number, isFirst: boolean, varStr: string): string {
  if (v === 0) return '';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  const absStr = abs === 1 && varStr ? '' : String(abs);
  if (isFirst) {
    return `${v < 0 ? '-' : ''}${absStr}${varStr}`;
  }
  return `${sign} ${absStr}${varStr}`;
}

export function formatPolynomial(fit: QuadFit): string {
  const { a, b, c } = fit;
  const parts: string[] = [];
  let isFirst = true;
  const aPart = fmtCoef(a, isFirst, 'n²');
  if (aPart) {
    parts.push(aPart);
    isFirst = false;
  }
  const bPart = fmtCoef(b, isFirst, 'n');
  if (bPart) {
    parts.push(bPart);
    isFirst = false;
  }
  const cPart = fmtCoef(c, isFirst, '');
  if (cPart) {
    parts.push(cPart);
  } else if (parts.length === 0) {
    parts.push('0');
  }
  return parts.join(' ');
}
