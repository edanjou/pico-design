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
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
