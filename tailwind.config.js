/** Cores e fontes vêm dos tokens em src/index.css (tema claro e escuro). */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: Object.fromEntries(
        ["bg", "surface", "raised", "line", "line-forte", "fg", "muted", "accent", "accent-soft", "accent-fg", "warn", "warn-soft", "ok", "ok-soft", "bad", "bad-soft"].map((n) => [
          n,
          `rgb(var(--${n}-c) / <alpha-value>)`,
        ]),
      ),
      borderRadius: { lg: "8px", xl: "10px", "2xl": "12px", "3xl": "16px" },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
