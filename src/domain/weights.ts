/** Default adjustable-dumbbell increments (kg per dumbbell) up to 41 kg. Editable in Settings. */
export const DEFAULT_WEIGHTS: number[] = [
  2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 41,
];

export function normalizeWeights(list: number[]): number[] {
  return [...new Set(list.filter((w) => Number.isFinite(w) && w > 0).map((w) => Math.round(w * 100) / 100))].sort((a, b) => a - b);
}

/** Nearest available weight; ties go to the lighter option. Empty list → value rounded to 0.5. */
export function snapWeight(target: number, weights: number[]): number {
  const list = normalizeWeights(weights);
  if (target <= 0) return 0;
  if (!list.length) return Math.round(target * 2) / 2;
  let best = list[0];
  for (const w of list) if (Math.abs(w - target) < Math.abs(best - target) - 1e-9) best = w;
  return best;
}

/** Next heavier available weight (or the same weight when already at the top). */
export function nextUp(current: number, weights: number[]): number {
  const list = normalizeWeights(weights);
  return list.find((w) => w > current + 1e-9) ?? (list.length ? list[list.length - 1] : current);
}

/** Next lighter available weight (or the lightest when already at the bottom). */
export function nextDown(current: number, weights: number[]): number {
  const list = normalizeWeights(weights);
  const lower = list.filter((w) => w < current - 1e-9);
  return lower.length ? lower[lower.length - 1] : list[0] ?? current;
}
