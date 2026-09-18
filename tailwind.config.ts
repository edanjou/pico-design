import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pico: {
          black: "#0a0a0a",
          cream: "#f8f1e9",
          accent: "#f07544",
          maroon: "#631028",
          "maroon-dark": "#4a0c1e",
        },
        // Tokens portés de PICO OS (voir app/globals.css) — utilisables en
        // plus des couleurs pico.* existantes (ex. bg-background, text-text,
        // bg-primary, text-primary-hover...).
        background: "var(--background)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        "text-subtle": "var(--text-subtle)",
        "text-on-brand": "var(--text-on-brand)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-subtle": "var(--primary-subtle)",
        accent: "var(--accent)",
        "accent-hover": "var(--accent-hover)",
        "accent-subtle": "var(--accent-subtle)",
        success: "var(--success)",
        "success-subtle": "var(--success-subtle)",
        warning: "var(--warning)",
        "warning-subtle": "var(--warning-subtle)",
        danger: "var(--danger)",
        "danger-subtle": "var(--danger-subtle)",
        info: "var(--info)",
        "info-subtle": "var(--info-subtle)",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
      },
      letterSpacing: {
        display: "var(--tracking-display)",
        body: "var(--tracking-body)",
        price: "var(--tracking-price)",
      },
      keyframes: {
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
