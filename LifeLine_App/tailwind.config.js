/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1E2B67",
        secondary: "#E07B3D",
        softwhite: "#FFFFFC",
        lifelineRed: "#DF3721",
      }
    },
  },
  plugins: [],
}

