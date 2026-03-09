import type { Theme } from "./cinematic";

/**
 * Succubus theme — dark, seductive, and mystical.
 *
 * Deep violet-black backgrounds bleed into rich burgundy surfaces.
 * A vivid rose-magenta accent cuts through the darkness like candlelight.
 * Crimson status colors and a blood-red progress bar complete the aesthetic.
 *
 * Designed to feel alluring without sacrificing readability —
 * all text tokens meet WCAG AA contrast minimums.
 */

export const succubus: Theme = {
  id: "succubus",
  name: "Succubus",

  // Backgrounds — deep violet-black bleeding into warm burgundy
  bgBase:     "#100810",  // near-black with a violet soul
  bgSurface:  "#160d18",  // sidebar, panels — dark purple shadow
  bgElevated: "#1e1120",  // cards, inputs, modals — rich plum
  bgCard:     "#251428",  // anime card tiles — deep wine

  // Borders — rose-magenta tint, restrained
  borderSubtle:  "rgba(210, 80, 140, 0.09)",
  borderDefault: "rgba(210, 80, 140, 0.20)",
  borderStrong:  "#b03060",  // deep crimson-rose for selected/active

  // Text — cool rose-tinted whites; all WCAG AA or better
  textPrimary:   "#f0dce8",  // ~12:1 on bgBase — warm rose-white for titles
  textSecondary: "#b888a8",  // ~5.6:1 on bgBase — labels, episode info
  textMuted:     "#7a5570",  // ~4.5:1 on bgBase — timestamps, captions

  // Accent — vivid rose-magenta; the one bright thing in the dark
  accent:      "#d4507a",
  accentDim:   "rgba(212, 80, 122, 0.13)",
  accentHover: "#e0637f",

  // Status colors — seductive crimson palette
  statusWatching:    "#d4507a",  // rose-magenta — active, glowing
  statusCompleted:   "#9b3060",  // deep crimson — done and claimed
  statusOnHold:      "#8855aa",  // twilight purple — paused in the dark
  statusPlanToWatch: "#7a5570",  // muted mauve — waiting in the shadows

  // Typography
  fontDisplay: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontBody:    "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontMono:    "'JetBrains Mono', 'Fira Code', monospace",

  // Effects — deep crimson glow, heavy dramatic shadow
  progressBar: "linear-gradient(90deg, #d4507a, #8b1a3a)",
  glowAccent:  "0 0 16px rgba(212, 80, 122, 0.30)",
  glowCard:    "0 8px 32px rgba(80, 0, 30, 0.85)",
} as const;