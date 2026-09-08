// Endless-mode number display (scope §15.9): scores can explode past
// comfortable integer ranges. Format large values as scientific notation
// before precision loss becomes visible; rules math stays in Number, which is
// exact to 2^53 — far beyond any realistic endless run.

export function formatScore(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  if (n < 1e9) return String(Math.round(n));
  if (n < 1e15) return `${(n / 1e9).toFixed(2)}B`;
  return n.toExponential(2).replace("e+", "e");
}
