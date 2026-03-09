import type { Theme } from "./cinematic";

/**
 * Everforest Dark theme inspired the the firefox theme Everforest Dark.
 *
 * Dark navy/slate base with warm golden-amber accents and a muted olive-green
 * highlight. Inspired by the retro terminal + dark UI aesthetic in the reference.
 *
 * v2 — UX pass:
 *   - textMuted:      #4e4a3e → #8a8070  (tripled luminance; now ~4.6:1 on bgBase)
 *   - textSecondary:  #9e9070 → #bcad90  (lifted ~20%; comfortably WCAG AA)
 *   - accentDim:      10%    → 13%      (active nav state reads clearer)
 *   - borderSubtle:   7%     → 10%      (panel edges now findable)
 *   - borderDefault:  15%    → 20%      (card borders visible at small sizes)
 *   - borderStrong:   #5a7a52 → #6a9162 (slightly brighter olive for selection box)
 */

export const everforest_dark: Theme = {
  id: "everforest_dark",
  name: "Everforest Dark",

  // Backgrounds — soft greenish-forest palette
  bgBase: "#202817",
  bgSurface: "#262e21",
  bgElevated: "#2b3326",
  bgCard: "#31392d",

  // Borders — warm amber with olive-green accents
  borderSubtle: "rgba(200, 169, 110, 0.10)",
  borderDefault: "rgba(200, 169, 110, 0.20)",
  borderStrong: "#6a9162",

  // Text — warm palette with improved contrast
  textPrimary: "#e8dfc8",
  textSecondary: "#bcad90",
  textMuted: "#8a8070",

  // Accent — golden amber with dimmed variant
  accent: "#c8a96e",
  accentDim: "rgba(200, 169, 110, 0.13)",
  accentHover: "#d4b876",

  // Status colors — warm amber variants
  statusWatching: "#c8a96e",
  statusCompleted: "#bcad90",
  statusOnHold: "#6a9162",
  statusPlanToWatch: "#8a8070",

  // Typography
  fontDisplay: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontBody: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontMono: "'Inter', 'Segoe UI', monospace",

  // Effects — warm amber glow with card shadow
  progressBar: "linear-gradient(90deg, #c8a96e, #a88848)",
  glowAccent: "0 0 12px rgba(200, 169, 110, 0.25)",
  glowCard: "0 8px 30px rgba(0, 0, 0, 0.8)",
} as const;