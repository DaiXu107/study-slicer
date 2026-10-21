/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c2b3a',
        'ink-soft': '#536473',
        'ink-faint': '#8b98a4',
        paper: '#f8f6f1',
        line: '#e8e3d8',
        accent: {
          DEFAULT: '#df7a3e',
          soft: '#fbeee3',
          deep: '#bf5d27',
        },
        moss: {
          DEFAULT: '#6f9b78',
          soft: '#edf4ee',
          deep: '#527a5b',
        },
        sun: '#f0c46a',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        display: ['Georgia', '"Times New Roman"', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 43, 58, 0.03), 0 14px 34px -22px rgba(28, 43, 58, 0.22)',
        lift: '0 2px 4px rgba(28, 43, 58, 0.04), 0 22px 48px -24px rgba(28, 43, 58, 0.28)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)' },
        },
        'confetti-fall': {
          '0%': { transform: 'translate3d(0, -8vh, 0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translate3d(var(--drift, 0px), 105vh, 0) rotate(680deg)', opacity: '0' },
        },
      },
      animation: {
        rise: 'rise 0.36s ease-out both',
        pop: 'pop 0.3s ease-out both',
      },
    },
  },
  plugins: [],
};
