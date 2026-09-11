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
          yellow: '#FFC107',
          dark: '#121212',
          gray: '#1E1E1E',
        }
      }
    },
  },
  plugins: [],
}