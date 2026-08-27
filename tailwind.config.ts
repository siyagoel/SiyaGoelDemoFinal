import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        elevated: "var(--bg-elevated)",
        panel: "var(--panel)",
        "panel-hover": "var(--panel-hover)",
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        fg: "var(--text)",
        "fg-hover": "var(--text-hover)",
        "on-fg": "var(--on-text)",
        muted: "var(--text-secondary)",
        faint: "var(--text-tertiary)",
        "overlay-1": "var(--overlay-1)",
        "overlay-2": "var(--overlay-2)",
        translucent: "var(--translucent-bg)",
        scrim: "var(--scrim)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        info: "var(--info)",
        "info-soft": "var(--info-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      boxShadow: {
        subtle: "var(--shadow-sm)",
        panel: "var(--shadow-md)",
        overlay: "var(--shadow-lg)",
      },
      animation: {
        "fade-in": "fade-in 160ms ease-out both",
        rise: "rise 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 140ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
export default config;
