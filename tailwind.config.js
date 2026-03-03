/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0faf3',
          100: '#d8f0de',
          200: '#b4e0c0',
          300: '#7ec99a',
          400: '#4aab6f',
          500: '#288f52',
          600: '#1a7241',
          700: '#155c36',
          800: '#0f4526',
          900: '#0a2e19',
          950: '#051a0e',
        },
        gold: {
          300: '#fde68a',
          400: '#fbbf24',
          500: '#d97706',
          600: '#b45309',
        },
      },
      fontFamily: {
        display: ['Outfit', 'system-ui', 'sans-serif'],
        sans:    ['Inter',  'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
