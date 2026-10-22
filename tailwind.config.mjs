import plugin from "tailwindcss/plugin";

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
  plugins: [
    plugin(function ({ addComponents }) {
      addComponents({
        // Static look: border + hard shadow + button box. Add `brutal-interactive` for hover/press.
        ".brutal": {
          "--brutal-color": "var(--black)",
          "--brutal-offset": "0px",
          display: "inline-block",
          border: "2px solid var(--brutal-color)",
          borderRadius: "1rem",
          padding: "1.25rem 2rem",
          fontSize: "1.25rem",
          lineHeight: "1.75rem",
          textAlign: "center",
          boxShadow:
            "var(--brutal-offset) var(--brutal-offset) 0 0 var(--brutal-color)",
        },
        ".brutal-sm": { "--brutal-offset": "2px" },
        ".brutal-md": { "--brutal-offset": "4px" },
        ".brutal-lg": { "--brutal-offset": "6px" },
        ".brutal-black": { "--brutal-color": "var(--black)" },
        ".brutal-indigo": { "--brutal-color": "var(--space-indigo)" },
        ".brutal-coral": { "--brutal-color": "var(--coral-glow)" },
        ".brutal-green": { "--brutal-color": "var(--green)" },
        ".brutal-interactive": {
          transition:
            "transform 200ms ease-out, box-shadow 200ms ease-out, background-color 200ms ease-out",
          "&:hover": {
            transform: "translate(-2px, -2px)",
            boxShadow:
              "calc(var(--brutal-offset) + 2px) calc(var(--brutal-offset) + 2px) 0 0 var(--brutal-color)",
          },
          "&:active": {
            transform: "translate(var(--brutal-offset), var(--brutal-offset))",
            boxShadow: "none",
          },
          "&:focus-visible": {
            outline: "2px solid var(--brutal-color)",
            outlineOffset: "4px",
          },
        },
      });
    }),
  ],
};
