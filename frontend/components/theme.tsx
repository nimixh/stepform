"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { IconMoon, IconSun } from "./builder/icons";

type Theme = "light" | "dark";
const KEY = "stepform-theme";

const Ctx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export const useTheme = () => useContext(Ctx);

function resolveInitial(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    /* private mode etc. — fall through to light */
  }
  return "light";
}

/** Owns the `data-theme` attribute on <html>; covers the creator workspace.
 *  The respondent flow always renders the form's own theme. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = document.documentElement.dataset.theme === "dark" ? "dark" : resolveInitial();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = () => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      document.documentElement.dataset.theme = next;
      return next;
    });
  };

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className="icon-btn"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      {dark ? <IconSun /> : <IconMoon />}
    </button>
  );
}
