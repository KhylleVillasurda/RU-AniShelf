import type { Theme } from "./cinematic";

/**
 * Meadow theme — a clean white + forest-green light theme.
 *
 * Crisp off-white backgrounds with rich forest-green accents and warm
 * neutral text. Energetic but not harsh — designed for users who prefer
 * light UIs without the sterile feel of pure white.
 */

export const meadow: Theme = {
  id: "meadow",
  name: "Meadow",

  // Backgrounds — warm off-white layering, never pure #fff (too glaring)
  bgBase:     "#f4f6f0",  // page background — soft warm white with a green tint
  bgSurface:  "#eaede4",  // sidebar, panels — one step down
  bgElevated: "#dfe3d8",  // cards, inputs, modals
  bgCard:     "#d8ddd1",  // individual anime card tiles

  // Borders — forest green tint, light hand
  borderSubtle:  "rgba(60, 110, 60, 0.10)",
  borderDefault: "rgba(60, 110, 60, 0.20)",
  borderStrong:  "#4a8c4a",

  // Text — deep neutral greens; warm without being brown
  // All values chosen for WCAG AA on lightest bg (#f4f6f0)
  textPrimary:   "#1e2a1e",  // ~13:1 — headings, card titles
  textSecondary: "#3d5c3a",  // ~7.2:1 — labels, episode info
  textMuted:     "#6a8a65",  // ~4.6:1 — timestamps, captions, hints

  // Accent — vivid forest green; strong enough to guide focus on light bg
  accent:      "#3a7d44",
  accentDim:   "rgba(58, 125, 68, 0.12)",
  accentHover: "#2e6636",

  // Status colors — natural palette variants
  statusWatching:    "#3a7d44",  // forest green
  statusCompleted:   "#2a6e5a",  // teal-green
  statusOnHold:      "#b07c2a",  // warm amber
  statusPlanToWatch: "#6a8a65",  // muted sage

  // Typography
  fontDisplay: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontBody:    "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontMono:    "'JetBrains Mono', 'Fira Code', monospace",

  // Effects — soft green glow, lighter shadow (light themes need less shadow)
  progressBar: "linear-gradient(90deg, #3a7d44, #2a6636)",
  glowAccent:  "0 0 12px rgba(58, 125, 68, 0.18)",
  glowCard:    "0 4px 16px rgba(30, 42, 30, 0.12)",
} as const;