/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        khmer: ["Kantumruy Pro", "Battambang", "system-ui", "sans-serif"],
        sans: ["Inter", "Kantumruy Pro", "Battambang", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
