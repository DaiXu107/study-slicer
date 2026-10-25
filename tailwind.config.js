/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--c-ink-soft) / <alpha-value>)',
        'ink-faint': 'rgb(var(--c-ink-faint) / <alpha-value>)',
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        done: 'rgb(var(--c-done) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-accent-deep) / <alpha-value>)',
        },
        moss: {
          DEFAULT: 'rgb(var(--c-moss) / <alpha-value>)',
          soft: 'rgb(var(--c-moss-soft) / <alpha-value>)',
          deep: 'rgb(var(--c-moss-deep) / <alpha-value>)',
        },
        sun: 'rgb(var(--c-sun) / <alpha-value>)',
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
          '100%': { opacity: '1', transform: 'none' },
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
