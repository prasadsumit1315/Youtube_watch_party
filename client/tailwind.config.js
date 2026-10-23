/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '16px',
        'theme': '16px',
      },
      colors: {
        brand: {
          violet: '#8B5CF6',
          pink: '#EC4899',
          purple: '#A855F7',
          darkBg: '#090A0F',
          darkSurface: '#12141F',
          darkCard: 'rgba(23, 26, 40, 0.75)',
          border: 'rgba(255, 255, 255, 0.1)',
        }
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
        'gradient-accent-hover': 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
      },
      backdropBlur: {
        glass: '16px',
      }
    },
  },
  plugins: [],
}
