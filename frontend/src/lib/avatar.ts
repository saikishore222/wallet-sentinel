/** Deterministic hue (0-359) derived from a mint address, for a stable per-token color. */
export function mintHue(mint: string): number {
  let hash = 0;
  for (let i = 0; i < mint.length; i += 1) {
    hash = (hash * 31 + mint.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}
