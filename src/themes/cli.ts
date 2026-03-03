import type { Theme } from "./cinematic";

export const cliTheme: Theme = {
  id: "cli",
  name: "CLI Terminal",

  // Backgrounds — pure blacks
  bgBase: "#000000",
  bgSurface: "#0a0a0a",
  bgElevated: "#111111",
  bgCard: "#0d0d0d",

  // Borders — phosphor green
  borderSubtle: "rgba(0,255,70,0.08)",
  borderDefault: "rgba(0,255,70,0.2)",
  borderStrong: "rgba(0,255,70,0.4)",

  // Text — phosphor green palette
  textPrimary: "#00ff46",
  textSecondary: "#00cc38",
  textMuted: "#005c19",

  // Accent — bright phosphor green
  accent: "#00ff46",
  accentDim: "rgba(0,255,70,0.1)",
  accentHover: "#00e63f",

  // Status colors — green variants
  statusWatching: "#00ff46",
  statusCompleted: "#00ffcc",
  statusOnHold: "#ffff00",
  statusPlanToWatch: "#005c19",

  // Misc
  progressBar: "linear-gradient(to right, #005c19, #00ff46)",
  fontDisplay: "'JetBrains Mono', monospace",
  fontBody: "'JetBrains Mono', monospace",
  fontMono: "'JetBrains Mono', monospace",

  // Glow effects — green phosphor
  glowAccent: "0 0 10px rgba(0,255,70,0.4)",
  glowCard: "0 8px 30px rgba(0,0,0,0.8)",
} as const;