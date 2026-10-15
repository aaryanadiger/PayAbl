type Point = { x: number; y: number };
type Bounds = { origin: Point; size: { width: number; height: number } };
export type Direction = 'left' | 'right' | 'up' | 'down' | 'center' | 'unknown';
export const QR_HINTS: Record<Direction, string> = {
  left: 'Move the phone left.', right: 'Move the phone right.',
  up: 'Move the phone up.', down: 'Move the phone down.',
  center: 'QR centered. Hold still.', unknown: 'QR found. Position unavailable. Use Read detected QR.',
};
// Android: pause, vibrate, pause, vibrate... No repeating motor patterns.
export const QR_PATTERNS: Record<Direction, number[]> = {
  left: [0, 70], right: [0, 70, 100, 70], up: [0, 220],
  down: [0, 220, 100, 220], center: [0, 50, 70, 50, 70, 50], unknown: [0, 100],
};

export function qrDirection(bounds: Bounds, points: Point[], view: { width: number; height: number }): Direction {
  if (view.width <= 0 || view.height <= 0) return 'unknown';
  let { x, y } = bounds.origin;
  let { width, height } = bounds.size;
  if (points.length >= 3 && points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) {
    x = Math.min(...points.map(p => p.x)); y = Math.min(...points.map(p => p.y));
    width = Math.max(...points.map(p => p.x)) - x; height = Math.max(...points.map(p => p.y)) - y;
  }
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return 'unknown';
  const dx = (x + width / 2) / view.width - .5;
  const dy = (y + height / 2) / view.height - .5;
  if (Math.abs(dx) <= .12 && Math.abs(dy) <= .12) return 'center';
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
}

export type QRTrack = { data: string; direction: Direction; since: number; seen: number };
export function trackQR(previous: QRTrack | null, data: string, direction: Direction, now: number): { track: QRTrack; accept: boolean } {
  const continuous = previous && previous.data === data && previous.direction === direction && now - previous.seen < 1200;
  const track = { data, direction, since: continuous ? previous.since : now, seen: now };
  return { track, accept: direction === 'center' && now - track.since >= 1000 };
}
