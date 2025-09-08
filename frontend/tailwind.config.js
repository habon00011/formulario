/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0b0b12',
        primary: '#8b5cf6', // violeta VilanovaCity
      },
      boxShadow: {
        card: '0 10px 40px -20px rgba(139,92,246,.45)',
      },
      keyframes: {
        blob: {
          '0%':   { transform: 'translate(0px,0px) scale(1)' },
          '33%':  { transform: 'translate(20px,-10px) scale(1.05)' },
          '66%':  { transform: 'translate(-10px,10px) scale(.95)' },
          '100%': { transform: 'translate(0px,0px) scale(1)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%':     { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        blob: 'blob 14s ease-in-out infinite',
        float: 'float 8s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
