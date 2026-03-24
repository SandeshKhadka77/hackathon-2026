/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15211f',
        muted: '#5d6d69',
        brand: {
          50: '#edf8f4',
          100: '#d3f0e3',
          200: '#a8dfc9',
          300: '#77c9ab',
          400: '#44af8c',
          500: '#1f9674',
          600: '#14795d',
          700: '#0f614c',
          800: '#0f4d3d',
          900: '#0d4033',
        },
      },
      boxShadow: {
        soft: '0 14px 36px rgba(11, 35, 26, 0.10)',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
