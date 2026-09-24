/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#04050a", 900: "#080a14", 800: "#0e1120", 700: "#161a2e" },
        signal: { 300: "#7fe7ff", 400: "#34d3ff", 500: "#0bb6e6" },
        ember: { 300: "#ffb27f", 400: "#ff8a3d", 500: "#f26a1b" },
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
