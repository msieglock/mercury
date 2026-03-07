/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        cream: "#FAFAF8",
        charcoal: "#1A1815",
        sienna: {
          DEFAULT: "#D4552A",
          50: "#FDF2EE",
          100: "#FAE1D8",
          200: "#F4BFA8",
          300: "#ED9A78",
          400: "#E67A50",
          500: "#D4552A",
          600: "#B54722",
          700: "#8C371A",
          800: "#632713",
          900: "#3A170B",
        },
        warm: {
          50: "#FAFAF8",
          100: "#F5F4F0",
          200: "#ECEAE4",
          300: "#D8D5CC",
          400: "#B8B3A7",
          500: "#98917F",
          600: "#7A7265",
          700: "#5C564B",
          800: "#3E3A33",
          900: "#1A1815",
        },
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
        sans: ["System", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};
