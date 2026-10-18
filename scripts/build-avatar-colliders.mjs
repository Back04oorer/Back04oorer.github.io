// Rebuild after replacing photo sprites. Requires sharp at build time only.
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const decomp = require('./vendor/poly-decomp.cjs');
const resolution = 128;
const root = new URL('../', import.meta.url);

function area(points) {
  return points.reduce((a, p, i) => {
    const q = points[(i + 1) % points.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
}

function simplifyOpen(points, tolerance) {
  if (points.length <= 2) return points;
  const [a, b] = [points[0], points.at(-1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  let distance = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
    const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    if (d > distance) { distance = d; index = i; }
  }
  if (distance <= tolerance) return [a, b];
  return [...simplifyOpen(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyOpen(points.slice(index), tolerance)];
}

function simplifyClosed(points, tolerance) {
  let split = 1;
  for (let i = 2; i < points.length; i++) {
    if (Math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]) >
        Math.hypot(points[split][0] - points[0][0], points[split][1] - points[0][1])) split = i;
  }
  return [...simplifyOpen(points.slice(0, split + 1), tolerance).slice(0, -1),
    ...simplifyOpen([...points.slice(split), points[0]], tolerance).slice(0, -1)];
}

function trace(mask) {
  const edges = new Map();
  const occupied = (x, y) => x >= 0 && y >= 0 && x < resolution && y < resolution && mask[y * resolution + x];
  const key = p => p.join(',');
  function edge(a, b) {
    const list = edges.get(key(a)) || [];
    list.push(b); edges.set(key(a), list);
  }
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    if (!occupied(x, y)) continue;
    if (!occupied(x, y - 1)) edge([x, y], [x + 1, y]);
    if (!occupied(x + 1, y)) edge([x + 1, y], [x + 1, y + 1]);
    if (!occupied(x, y + 1)) edge([x + 1, y + 1], [x, y + 1]);
    if (!occupied(x - 1, y)) edge([x, y + 1], [x, y]);
  }
  const contours = [];
  while (edges.size) {
    const start = edges.keys().next().value.split(',').map(Number);
    const points = [start];
    let current = start, incoming = [1, 0];
    do {
      const choices = edges.get(key(current));
      if (!choices?.length) throw Error('Open alpha contour');
      let choice = 0, best = Infinity;
      for (let i = 0; i < choices.length; i++) {
        const direction = [choices[i][0] - current[0], choices[i][1] - current[1]];
        const turn = (Math.atan2(incoming[0] * direction[1] - incoming[1] * direction[0],
          incoming[0] * direction[0] + incoming[1] * direction[1]) + Math.PI * 2) % (Math.PI * 2);
        if (turn < best) { best = turn; choice = i; }
      }
      const next = choices.splice(choice, 1)[0];
      if (!choices.length) edges.delete(key(current));
      incoming = [next[0] - current[0], next[1] - current[1]];
      current = next;
      if (key(current) !== key(start)) points.push(current);
    } while (key(current) !== key(start));
    // Ignore isolated subpixel wisps and enclosed tiny hair holes for stable physics.
    for (const loop of splitLoops(points)) if (area(loop) >= 8) contours.push(loop);
  }
  return contours;
}

function splitLoops(points) {
  const seen = new Map();
  for (let i = 0; i < points.length; i++) {
    const key = points[i].join(',');
    if (seen.has(key)) {
      const j = seen.get(key);
      return [...splitLoops(points.slice(j, i)), ...splitLoops([...points.slice(0, j), ...points.slice(i)])];
    }
    seen.set(key, i);
  }
  return points.length >= 3 ? [points] : [];
}

function simplifySimple(points, tolerance) {
  let result = points.map(p => [...p]);
  decomp.removeCollinearPoints(result, .001);
  let changed = true;
  while (changed && result.length > 4) {
    changed = false;
    for (let i = 0; i < result.length; i++) {
      const a = result[(i + result.length - 1) % result.length], p = result[i], b = result[(i + 1) % result.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
      const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) > tolerance) continue;
      const candidate = result.filter((_, j) => i !== j);
      if (decomp.isSimple(candidate)) { result = candidate; changed = true; i--; }
    }
  }
  return result;
}

const shapes = {};
for (const name of ['bob', 'polka-hat', 'closeup', 'cat-hat', 'parted-bob']) {
  const { data, info } = await sharp(fileURLToPath(new URL(`assets/avatars/photo/${name}.webp`, root)))
    .resize(resolution, resolution).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Array.from({ length: resolution * resolution }, (_, i) => data[i * info.channels + 3] >= 64);
  const contours = trace(mask);
  const parts = [];
  for (const contour of contours) {
    let polygon = simplifyClosed(contour, 1.25);
    if (!decomp.isSimple(polygon)) polygon = simplifySimple(contour, 1.25);
    if (!decomp.isSimple(polygon)) throw Error(`${name}: non-simple contour`);
    decomp.makeCCW(polygon);
    decomp.removeCollinearPoints(polygon, .001);
    const chunks = decomp.quickDecomp(polygon);
    for (const chunk of chunks) if (Math.abs(area(chunk)) >= .3) {
      parts.push(chunk.map(([x, y]) => [Number((x / resolution - .5).toFixed(6)), Number((y / resolution - .5).toFixed(6))]));
    }
  }
  if (!parts.length) throw Error(`${name}: empty collider`);
  shapes[name] = { parts };
  console.log(`${name}: ${contours.length} contours, ${parts.length} convex parts`);
}
await writeFile(new URL('assets/avatar-colliders.mjs', root),
  '// Generated from photo WebP alpha at 128px; threshold 64/255; tolerance 1.25px.\n' +
  '// Coordinates are relative to the centre and size of the complete sprite canvas.\n' +
  `export const AVATAR_SHAPES = ${JSON.stringify(shapes)};\n`);
