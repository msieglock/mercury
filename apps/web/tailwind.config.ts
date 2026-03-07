import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // M3 Primary
        primary: {
          DEFAULT: '#1A237E',
          container: '#DEE0FF',
        },
        onPrimary: {
          DEFAULT: '#FFFFFF',
          container: '#00105C',
        },
        // M3 Secondary
        secondary: {
          DEFAULT: '#5B5D72',
          container: '#DFE1F9',
        },
        onSecondary: {
          DEFAULT: '#FFFFFF',
          container: '#181A2E',
        },
        // M3 Tertiary
        tertiary: {
          DEFAULT: '#77536D',
          container: '#FFD7F1',
        },
        onTertiary: {
          DEFAULT: '#FFFFFF',
          container: '#2D1228',
        },
        // M3 Error
        error: {
          DEFAULT: '#BA1A1A',
          container: '#FFDAD6',
        },
        onError: {
          DEFAULT: '#FFFFFF',
          container: '#410002',
        },
        // M3 Surface & Background
        background: '#FEFBFF',
        onBackground: '#1B1B1F',
        surface: {
          DEFAULT: '#FEFBFF',
          variant: '#E3E1EC',
          containerLow: '#F5F2F7',
          container: '#EFEDF1',
          containerHigh: '#E9E7EC',
        },
        onSurface: {
          DEFAULT: '#1B1B1F',
          variant: '#46464F',
        },
        // M3 Outline
        outline: {
          DEFAULT: '#767680',
          variant: '#C7C5D0',
        },
        // M3 Inverse
        inverseSurface: '#303034',
        inverseOnSurface: '#F3F0F4',
      },
      borderRadius: {
        // M3 Shape system
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '28px',
      },
      fontFamily: {
        sans: [
          'Roboto',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      boxShadow: {
        // M3 Elevation levels
        'elevation-0': 'none',
        'elevation-1':
          '0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)',
        'elevation-2':
          '0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
        'elevation-3':
          '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)',
        'elevation-4':
          '0 6px 10px 4px rgba(0, 0, 0, 0.15), 0 2px 3px rgba(0, 0, 0, 0.3)',
        'elevation-5':
          '0 8px 12px 6px rgba(0, 0, 0, 0.15), 0 4px 4px rgba(0, 0, 0, 0.3)',
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
