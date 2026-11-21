export const NAMED_COLORS: Record<string, string> = {
  white: "#f2efe8", ivory: "#e8dfc9", beige: "#d6c5a6", grey: "#b4b3af", gray: "#b4b3af",
  charcoal: "#4b4b4f", black: "#26262a", navy: "#2f4468", green: "#728f78", terracotta: "#c4704f",
  brown: "#7a5538", oak: "#b98a56", walnut: "#6b4a2f", mustard: "#d1a02a", blush: "#e2b8ae",
  blue: "#6f93b8", brass: "#b8963e", gold: "#b8963e", cream: "#e8dfc9", red: "#a8423a",
  pink: "#e2b8ae", yellow: "#d1a02a", orange: "#c4704f", silver: "#b4b3af", tan: "#d6c5a6",
  mahogany: "#6e2f1f", teak: "#9c6b3c", natural: "#cbb489", rust: "#9a4a2a", sisal: "#cbb489", jute: "#cbb489",
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

export function rgbToLab([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

export function deltaE(hexA: string, hexB: string) {
  const a = rgbToLab(hexToRgb(hexA));
  const b = rgbToLab(hexToRgb(hexB));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function colorNameToHex(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.toLowerCase().split(/[\s/,-]+/).find((t) => NAMED_COLORS[t]);
  return key ? NAMED_COLORS[key] : null;
}

export function nearestColorName(hex: string) {
  let best = "grey";
  let bestD = Infinity;
  for (const [name, h] of Object.entries(NAMED_COLORS)) {
    if (["gray", "gold", "cream", "pink", "red", "yellow", "orange", "silver", "tan", "sisal", "jute"].includes(name)) continue;
    const d = deltaE(hex, h);
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

// 0..1: 1 for identical colours, 0 when the CIE76 distance is 50 or more.
export function colorScore(itemHexes: string[], productHexes: string[]): number {
  if (itemHexes.length === 0 || productHexes.length === 0) return 0.5;
  let best = Infinity;
  for (const a of itemHexes) for (const b of productHexes) best = Math.min(best, deltaE(a, b));
  return 1 - Math.min(1, best / 50);
}
