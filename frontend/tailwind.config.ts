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
        teal: {
          50: "#F0FDF4",
          100: "#E6F4F1",
          500: "#0F4C5C",
          600: "#0D404E",
          700: "#0A333E",
          800: "#07262E",
          900: "#04181D",
        },
        primary: {
          DEFAULT: "#0F4C5C",
          hover: "#0D404E",
        },
        clinical: {
          green: "#2A9D8F",
          amber: "#F4A261",
          orange: "#E76F51",
          red: "#E63946",
          dark: "#1A252C",
          muted: "#64748B",
          card: "#FFFFFF",
          bg: "#F8FAFC"
        }
      },
    },
  },
  plugins: [],
};
export default config;
