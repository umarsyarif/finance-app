/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pastel-green': '#e6f9f1',
        'pastel-green-dark': '#68bfae',
        'pastel-blue': '#7ec4cf',
        'pastel-yellow': '#fff9db',
        'pastel-red': '#f4978e',
      },
      borderRadius: {
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
}