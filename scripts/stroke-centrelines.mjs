// Build-time helpers for stroke centrelines: the path a pen follows through a
// stroke, used for numbers, arrows, colours and animation in stroke views.
// Centrelines are stored as SVG polyline point lists ("x,y x,y …") in the
// character's viewBox coordinates, after any source transform.

/** Flattens an SVG path made of M/L/H/V/C/S/Z commands into points. */
export function flattenSvgPath(d, samplesPerCurve = 8) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const points = [];
  let index = 0;
  let command = "";
  let current = [0, 0];
  let start = [0, 0];
  let lastControl = null;
  const number = () => Number(tokens[index++]);
  const push = (point) => {
    const last = points[points.length - 1];
    if (!last || last[0] !== point[0] || last[1] !== point[1]) points.push(point);
  };
  const cubic = (p0, p1, p2, p3) => {
    for (let step = 1; step <= samplesPerCurve; step += 1) {
      const t = step / samplesPerCurve;
      const u = 1 - t;
      push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
  };
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++];
    const relative = command === command.toLowerCase();
    const offset = (x, y) => (relative ? [current[0] + x, current[1] + y] : [x, y]);
    switch (command.toUpperCase()) {
      case "M": {
        current = offset(number(), number());
        start = current;
        push(current);
        command = relative ? "l" : "L"; // further pairs are line-tos
        lastControl = null;
        break;
      }
      case "L":
        current = offset(number(), number());
        push(current);
        lastControl = null;
        break;
      case "H":
        current = [relative ? current[0] + number() : number(), current[1]];
        push(current);
        lastControl = null;
        break;
      case "V":
        current = [current[0], relative ? current[1] + number() : number()];
        push(current);
        lastControl = null;
        break;
      case "C": {
        const c1 = offset(number(), number());
        const c2 = offset(number(), number());
        const end = offset(number(), number());
        cubic(current, c1, c2, end);
        lastControl = c2;
        current = end;
        break;
      }
      case "S": {
        const c1 = lastControl
          ? [2 * current[0] - lastControl[0], 2 * current[1] - lastControl[1]]
          : current;
        const c2 = offset(number(), number());
        const end = offset(number(), number());
        cubic(current, c1, c2, end);
        lastControl = c2;
        current = end;
        break;
      }
      case "Z":
        current = start;
        push(current);
        lastControl = null;
        break;
      default:
        throw new Error(`Unsupported SVG path command ${command} in ${d}`);
    }
  }
  return points;
}

function perpendicularDistance(point, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(point[0] - a[0], point[1] - a[1]);
  return Math.abs(dy * point[0] - dx * point[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

/** Ramer-Douglas-Peucker simplification; keeps the first and last points. */
export function simplifyPolyline(points, tolerance) {
  if (points.length <= 2) return points;
  let farthest = 0;
  let index = 0;
  for (let k = 1; k < points.length - 1; k += 1) {
    const distance = perpendicularDistance(points[k], points[0], points[points.length - 1]);
    if (distance > farthest) {
      farthest = distance;
      index = k;
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]];
  return [
    ...simplifyPolyline(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyPolyline(points.slice(index), tolerance),
  ];
}

/**
 * Simplifies a centreline relative to its viewBox width and formats it as SVG
 * polyline points, rounded to whole units for large canvases and to tenths
 * for small ones.
 */
export function formatCentreline(points, viewBoxWidth) {
  const simplified = simplifyPolyline(points, viewBoxWidth * 0.004);
  const digits = viewBoxWidth >= 500 ? 0 : 1;
  const round = (value) => Number(value.toFixed(digits));
  const out = [];
  for (const [x, y] of simplified) {
    const point = `${round(x)},${round(y)}`;
    if (out[out.length - 1] !== point) out.push(point);
  }
  return out.join(" ");
}
