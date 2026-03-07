import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAFAF8',
          50: '#FEFEFE',
          100: '#FAFAF8',
          200: '#F5F5F0',
          300: '#EDEDEA',
          400: '#E5E5E0',
          500: '#D5D5D0',
        },
        charcoal: {
          DEFAULT: '#1A1815',
          50: '#8A8680',
          100: '#6B6860',
          200: '#524F48',
          300: '#3A3830',
          400: '#2A2820',
          500: '#1A1815',
        },
        sienna: {
          DEFAULT: '#D4552A',
          50: '#F9E8E2',
          100: '#F2C9BB',
          200: '#E8A08A',
          300: '#DE7A5A',
          400: '#D4552A',
          500: '#B84722',
          600: '#9A3B1C',
        },
        warm: {
          gray: {
            50: '#FAF9F7',
            100: '#F3F2EE',
            200: '#E8E6E1',
            300: '#D4D1CB',
            400: '#B8B4AD',
            500: '#9C978F',
            600: '#7A756D',
            700: '#5C5850',
            800: '#3D3A34',
            900: '#1F1D18',
          },
        },
      },
      borderRadius: {
        mercury: '12px',
        'mercury-lg': '16px',
        'mercury-xl': '20px',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'mercury-sm': '0 1px 3px rgba(26, 24, 21, 0.04), 0 1px 2px rgba(26, 24, 21, 0.06)',
        mercury: '0 4px 6px rgba(26, 24, 21, 0.04), 0 2px 4px rgba(26, 24, 21, 0.06)',
        'mercury-md': '0 6px 12px rgba(26, 24, 21, 0.06), 0 3px 6px rgba(26, 24, 21, 0.04)',
        'mercury-lg': '0 12px 24px rgba(26, 24, 21, 0.08), 0 4px 8px rgba(26, 24, 21, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
