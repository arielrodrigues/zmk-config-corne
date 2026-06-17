// Physical layout of the 42-key Corne, in arbitrary units (1 = one key width).
// Keys 0..35 are the 6×3 split grid; 36..41 are the six thumb keys.
// Origin is top-left of the SVG.

export type KeyRect = {
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Column stagger (y offset per column) — ergo Corne-style.
const COL_STAGGER_LEFT = [0.25, 0, -0.25, -0.5, -0.25, 0];
const COL_STAGGER_RIGHT = [0, -0.25, -0.5, -0.25, 0, 0.25];

const HALF_GAP = 1.5;
const HALF_WIDTH = 6;

const TOP_PADDING = 0.6;

function gridKey(row: number, halfCol: number, half: 'left' | 'right'): { x: number; y: number } {
  const stagger = half === 'left' ? COL_STAGGER_LEFT[halfCol] : COL_STAGGER_RIGHT[halfCol];
  const x = half === 'left' ? halfCol : HALF_WIDTH + HALF_GAP + halfCol;
  const y = TOP_PADDING + row + stagger;
  return { x, y };
}

export function corneLayout(): KeyRect[] {
  const rects: KeyRect[] = [];

  // Rows 0..2: 12 keys each, position = row*12 + col where col 0..5 is left, 6..11 is right.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 12; col++) {
      const half = col < 6 ? 'left' : 'right';
      const halfCol = col < 6 ? col : col - 6;
      const { x, y } = gridKey(row, halfCol, half);
      rects.push({ position: row * 12 + col, x, y, width: 1, height: 1 });
    }
  }

  // Thumbs: 36..41.
  // Left thumbs sit roughly under the F/G/(inner-index) area, fanning toward center.
  // Right thumbs mirror.
  const thumbY = TOP_PADDING + 3 + 0.4;
  // Position the three left thumbs slanted inward; same for right.
  const leftThumbX = [3.25, 4.25, 5.25];
  const rightThumbX = [HALF_WIDTH + HALF_GAP + 0, HALF_WIDTH + HALF_GAP + 1, HALF_WIDTH + HALF_GAP + 2];
  for (let i = 0; i < 3; i++) {
    rects.push({ position: 36 + i, x: leftThumbX[i], y: thumbY + (2 - i) * 0.15, width: 1, height: 1 });
  }
  for (let i = 0; i < 3; i++) {
    rects.push({
      position: 39 + i,
      x: rightThumbX[i],
      y: thumbY + i * 0.15,
      width: 1,
      height: 1,
    });
  }

  return rects;
}

export function layoutBoundingBox(rects: KeyRect[]): { width: number; height: number } {
  let maxX = 0;
  let maxY = 0;
  for (const r of rects) {
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  return { width: maxX, height: maxY };
}
