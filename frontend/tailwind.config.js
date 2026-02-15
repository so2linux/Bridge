/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      backdropBlur: {
        xs: '2px',
        glass: '12px',
        'glass-lg': '20px',
        xl: '24px',
        '2xl': '40px',
      },
      animation: {
        'pulse-echo': 'pulse-echo 1.5s ease-in-out infinite',
        'gift-glow': 'gift-glow 2s ease-in-out infinite',
        'voice-wave': 'voice-wave 1.2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-echo': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.02)' },
        },
        'gift-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(251, 191, 36, 0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(251, 191, 36, 0.8)' },
        },
        'voice-wave': {
          '0%, 100%': { transform: 'scaleY(0.4)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      colors: {
        bridge: {
          milk: '#faf9f7',
          deepBlue: '#0c1222',
          oled: '#000000',
        },
      },
    },
  },
  plugins: [],
}
