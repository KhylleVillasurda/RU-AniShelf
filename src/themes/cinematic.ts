export interface Theme {
  id: string;
  name: string;
  bgBase: string;
  bgSurface: string;
  bgElevated: string;
  bgCard: string;
  borderSubtle: string;
  borderDefault: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentDim: string;
  accentHover: string;
  statusWatching: string;
  statusCompleted: string;
  statusOnHold: string;
  statusPlanToWatch: string;
  progressBar: string;
  fontDisplay: string;
  fontBody: string;
  fontMono: string;
  glowAccent: string;
  glowCard: string;
}

export const cinematicTheme: Theme = {
  id: "cinematic",
  name: "Dark Cinematic",

  // Backgrounds
  bgBase: "#050508",
  bgSurface: "#0e0e1a",
  bgElevated: "#13131f",
  bgCard: "#16162a",

  // Borders
  borderSubtle: "rgba(0,212,255,0.08)",
  borderDefault: "rgba(0,212,255,0.15)",
  borderStrong: "rgba(0,212,255,0.3)",

  // Text
  textPrimary: "#f0f4ff",
  textSecondary: "#8899bb",
  textMuted: "#445566",

  // Accent
  accent: "#00d4ff",
  accentDim: "rgba(0,212,255,0.1)",
  accentHover: "#00bfe8",

  // Status colors
  statusWatching: "#00d4ff",
  statusCompleted: "#00ff9d",
  statusOnHold: "#ffaa00",
  statusPlanToWatch: "#667799",

  // Misc
  progressBar: "linear-gradient(to right, #0099cc, #00d4ff)",
  fontDisplay: "'Syne', sans-serif",
  fontBody: "'DM Sans', sans-serif",
  fontMono: "'JetBrains Mono', monospace",

  // Glow effects
  glowAccent: "0 0 10px rgba(0,212,255,0.4)",
  glowCard: "0 8px 30px rgba(0,0,0,0.5)",
} as const;
