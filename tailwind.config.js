/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // The City design tokens — mapped to CSS variables in src/index.css so
        // buildings can theme via tokens (PRD §7.3, §8) without forking styles.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--c-surface-2) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        text: "rgb(var(--c-text) / <alpha-value>)",
        gold: "rgb(var(--c-gold) / <alpha-value>)",
        coin: "rgb(var(--c-coin) / <alpha-value>)",
        accent: "rgb(var(--c-accent) / <alpha-value>)",
        success: "rgb(var(--c-success) / <alpha-value>)",
        danger: "rgb(var(--c-danger) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Outfit", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "float-up": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "20%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(-26px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "0.8" },
        },
        "drift-x": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(46px)" },
        },
        // The waiting-room steam. Three wisps on staggered delays; each rises,
        // widens and fades, so the loop reads as a cup being watched rather than
        // a progress bar pretending to know how long the grader will take.
        steam: {
          "0%": { opacity: "0", transform: "translateY(0) scaleX(0.7)" },
          "25%": { opacity: "0.75" },
          "100%": { opacity: "0", transform: "translateY(-14px) scaleX(1.5)" },
        },
        // Skyline layers loop by sliding exactly one gradient period.
        "skyline-far": { to: { backgroundPosition: "-88px 0" } },
        "skyline-mid": { to: { backgroundPosition: "-72px 0" } },
        "skyline-near": { to: { backgroundPosition: "-60px 0" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out",
        "pop-in": "pop-in 0.22s cubic-bezier(0.34, 1.4, 0.64, 1)",
        "slide-up": "slide-up 0.25s ease-out",
        "float-up": "float-up 1.6s ease-out forwards",
        twinkle: "twinkle 4s ease-in-out infinite",
        "drift-a": "drift-x 18s ease-in-out infinite alternate",
        "drift-b": "drift-x 26s ease-in-out infinite alternate",
        steam: "steam 2.4s ease-out infinite",
        "skyline-far": "skyline-far 80s linear infinite",
        "skyline-mid": "skyline-mid 45s linear infinite",
        "skyline-near": "skyline-near 25s linear infinite",
      },
    },
  },
  plugins: [],
};
