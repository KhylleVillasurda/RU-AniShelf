import type { Theme } from "./cinematic";

/**
 * Obsidian theme — a soft, approachable dark theme for everyday users.
 *
 * Near-black backgrounds with gentle cool-neutral surfaces and a calm
 * sky-blue accent. No harsh contrasts, no neon — just clean and easy
 * on the eyes for long sessions.
 */

export const obsidian: Theme = {
  id: "obsidian",
  name: "Obsidian",

  // Backgrounds — near-black with a barely perceptible cool undertone
  bgBase:     "#0f1117",  // deepest layer — soft black, not pure #000
  bgSurface:  "#161820",  // sidebar, panels
  bgElevated: "#1c1f2a",  // cards, inputs, modals
  bgCard:     "#212530",  // individual anime card tiles

  // Borders — cool blue-gray, light touch
  borderSubtle: "rgba(120, 140, 200, 0.08)",
  borderDefault: "rgba(120, 140, 200, 0.16)",
  borderStrong: "rgba(120, 140, 200, 0.45)",

  // Text — neutral-cool whites, all WCAG AA or better
  textPrimary:   "#dde3f0",  // ~11:1 on bgBase — titles, main content
  textSecondary: "#8e96b0",  // ~5.8:1 on bgBase — labels, meta info
  textMuted:     "#565e78",  // ~4.5:1 on bgBase — timestamps, captions

  // Accent — calm sky blue; comfortable for long use, not eye-straining
  accent:    "#7aa2d4",
  accentDim: "rgba(122, 162, 212, 0.12)",
  accentHover: "#91b8e8",

  // Status colors — desaturated, soft variants that suit the dark palette
  statusWatching:    "#7aa2d4",  // sky blue
  statusCompleted:   "#76b09a",  // muted teal-green
  statusOnHold:      "#c4a76b",  // muted amber
  statusPlanToWatch: "#8e96b0",  // neutral slate

  // Typography
  fontDisplay: "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontBody:    "'Inter', 'Segoe UI', system-ui, sans-serif",
  fontMono:    "'JetBrains Mono', 'Fira Code', monospace",

  // Effects — subtle blue glow, soft card shadow
  progressBar: "linear-gradient(90deg, #7aa2d4, #4f7ab8)",
  glowAccent:  "0 0 14px rgba(122, 162, 212, 0.20)",
  glowCard:    "0 8px 30px rgba(0, 0, 0, 0.75)",
} as const;