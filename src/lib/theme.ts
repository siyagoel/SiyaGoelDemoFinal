/**
 * Theme resolution. Kept pure and separate from the toggle component so the
 * precedence rule (stored choice, otherwise the dark default) is testable and
 * so the inline no-flash script can reuse the same storage key.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "northwind-theme";

/** The product is dark-first; light is opt-in, not inferred from the OS. */
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function resolveTheme(stored: string | null): Theme {
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
