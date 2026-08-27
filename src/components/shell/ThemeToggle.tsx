"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  nextTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";
import { IconMoon, IconSun } from "@/components/ui/icons";

/**
 * The rendered icon has to match what the pre-paint script in layout.tsx
 * already applied, so the theme is read from the DOM on mount rather than
 * guessed during render.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  useEffect(() => {
    setTheme(resolveTheme(document.documentElement.dataset.theme ?? null));
  }, []);

  function toggle() {
    const value = nextTheme(theme);
    setTheme(value);
    document.documentElement.dataset.theme = value;
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  }

  const target = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${target} theme`}
      title={`Switch to ${target} theme`}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-elevated text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {theme === "dark" ? (
        <IconSun className="h-4 w-4" />
      ) : (
        <IconMoon className="h-4 w-4" />
      )}
    </button>
  );
}
