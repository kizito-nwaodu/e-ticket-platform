/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#111827',
          deep: '#0B0F19',
          light: '#1F2937',
          muted: '#4B5563',
        },
        ivory: {
          DEFAULT: '#F7F5F0',
          dark: '#EFECE6',
          light: '#FAF9F6',
        },
        tangerine: {
          DEFAULT: '#F06436',
          hover: '#D85428',
          subtle: '#FFF5F2',
          border: '#FDC4B4',
        },
        forest: {
          DEFAULT: '#16845B',
          light: '#EAF6F1',
          border: '#A7DECB',
        },
        warning: {
          DEFAULT: '#D99A27',
          subtle: '#FEF8EC',
        },
        crimson: {
          DEFAULT: '#D83D48',
          subtle: '#FDECEE',
          border: '#F8B4B9',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['var(--font-heading)', 'Instrument Sans', '-apple-system', 'sans-serif'],
        heading: ['var(--font-heading)', 'Instrument Sans', '-apple-system', 'sans-serif'],
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1.15rem' }],   // 12px
        'xs': ['0.8125rem', { lineHeight: '1.25rem' }],  // 13px (enlarged from 12px)
        'sm': ['0.9375rem', { lineHeight: '1.4rem' }],   // 15px (enlarged from 14px)
        'base': ['1rem', { lineHeight: '1.5rem' }],      // 16px
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],   // 18px
        'xl': ['1.25rem', { lineHeight: '1.85rem' }],    // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],  // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
        '5xl': ['3rem', { lineHeight: '1.15' }],         // 48px
      },
      borderRadius: {
        'card': '12px',
        'badge': '6px',
        'btn': '8px',
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(17, 24, 39, 0.05), 0 1px 2px -1px rgba(17, 24, 39, 0.05)',
        'elevated': '0 4px 6px -1px rgba(17, 24, 39, 0.06), 0 2px 4px -2px rgba(17, 24, 39, 0.04)',
        'modal': '0 20px 25px -5px rgba(17, 24, 39, 0.1), 0 8px 10px -6px rgba(17, 24, 39, 0.1)',
      }
    },
  },
  plugins: [],
}
