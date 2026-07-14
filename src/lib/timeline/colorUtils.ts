// Pure initiative-color resolution (D-11) and bar-text contrast. No external deps.

/** Deterministic fallback ramp for initiatives whose API color is null (D-11). */
export const FALLBACK_PALETTE = [
  "#10b981",
  "#6366f1",
  "#14b8a6",
  "#ec4899",
  "#f97316",
];

/**
 * Returns the initiative's API color when set, else a stable fallback keyed by the
 * initiative's position in the lexicographically-sorted list of null-color ids (D-11).
 */
export function resolveInitiativeColor(
  initiative: { id: string; color: string | null },
  allInitiatives: Array<{ id: string; color: string | null }>
): string {
  if (initiative.color) return initiative.color;
  const sortedNullIds = allInitiatives
    .filter((i) => !i.color)
    .map((i) => i.id)
    .sort(); // lexicographic — stable across renders
  const idx = sortedNullIds.indexOf(initiative.id);
  return FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

/** Expand an sRGB channel [0,1] to linear light (WCAG relative-luminance gamma). */
function linearize(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance of a #rrggbb color. The caller picks white bar text when the
 * result is < 0.4 (dark fills) and near-black otherwise. Gamma-corrected so mid-tone
 * saturated colors (e.g. #5e6ad2 linear-purple) correctly resolve below the 0.4 cut.
 */
export function luminanceFor(hex: string): number {
  const r = linearize(parseInt(hex.slice(1, 3), 16) / 255);
  const g = linearize(parseInt(hex.slice(3, 5), 16) / 255);
  const b = linearize(parseInt(hex.slice(5, 7), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
