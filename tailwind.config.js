/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#1D9E75",
          dark: "#085041",
          light: "#E1F5EE",
        },
        bg: {
          dark: "#0a0a0a",
          card: "#1a1a2e",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#AAAAAA",
        }
      },
      boxShadow: {
        glow: "0 0 20px rgba(29, 158, 117, 0.3)",
        "glow-lg": "0 0 35px rgba(29, 158, 117, 0.5)",
      }
    },
  },
  plugins: [],
}
