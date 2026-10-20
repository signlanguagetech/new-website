/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      fontFamily: {
        grotesk: ["Grotesk", "sans-serif"],
      },
      fontWeight: {
        regular: 400,
        medium: 500,
      },
      colors: {
        white: "var(--white)",
        black: "var(--black)",
        spaceIndigo: "var(--space-indigo)",
        coralGlow: "var(--coral-glow)",
        green: "var(--green)",
        dark: "var(--dark)",
        gray: "var(--gray)",
      },
    },
  },
  plugins: [],
};
