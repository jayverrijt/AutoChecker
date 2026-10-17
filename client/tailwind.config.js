/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        picnic: {
          bg: '#141416',
          card: '#1e1f23',
          cardBorder: '#2a2b32',
          blue: '#2c6cfb',
          blueHover: '#1d5beb',
          blueDark: '#1a3268',
          green: '#10b981',
          greenBorder: '#059669',
          yellow: '#f59e0b',
          bulb: '#fcd34d',
          red: '#ef4444',
          subtext: '#9ca3af',
          muted: '#6b7280',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'bounce-subtle': 'bounceSubtle 2s infinite ease-in-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { filter: 'drop-shadow(0 0 10px rgba(252, 211, 77, 0.7))' },
          '50%': { filter: 'drop-shadow(0 0 20px rgba(252, 211, 77, 1))' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        }
      }
    },
  },
  plugins: [],
}
