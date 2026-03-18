import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { cinematicTheme, Theme } from "../themes/cinematic";
import { cliTheme } from "../themes/cli";
import { everforest_dark } from "../themes/everforestdark";
import { obsidian } from "../themes/obsidian";
import { meadow } from "../themes/meadow";
import { succubus } from "../themes/succubus";
import { invoke } from "@tauri-apps/api/core";

export const themes = {
  cinematic: cinematicTheme,
  cli: cliTheme,
  everforest_dark: everforest_dark,
  obsidian: obsidian,
  meadow: meadow,
  succebus: succubus,
};

export type ThemeId = keyof typeof themes;

interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: cinematicTheme,
  themeId: "cinematic",
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>("cinematic");

  // Load saved theme from SQLite on startup
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await invoke<string | null>("get_setting", {
          key: "theme",
        });
        if (saved && saved in themes) {
          setThemeIdState(saved as ThemeId);
        }
      } catch {
        // silently ignore — default to cinematic
      }
    }
    loadTheme();
  }, []);

  async function setThemeId(id: ThemeId) {
    setThemeIdState(id);
    // Persist to SQLite
    try {
      await invoke("save_setting", { key: "theme", value: id });
    } catch {
      // silently ignore
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme: themes[themeId],
        themeId,
        setThemeId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook for easy access
export function useTheme() {
  return useContext(ThemeContext);
}
