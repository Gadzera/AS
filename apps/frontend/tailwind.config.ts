import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:        '#fbfbfa',
        surface:   '#ffffff',
        'surface-2':'#f6f6f4',
        line:      '#e8e8e3',
        'line-strong': '#d6d6d0',
        ink: {
          DEFAULT: '#18181b',
          muted:   '#6b7280',
          subtle:  '#9ca3af',
        },
        brand: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        xs:    '0 1px 1px rgba(15,23,42,0.04)',
        sm:    '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)',
        md:    '0 4px 12px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        lg:    '0 12px 32px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.04)',
        focus: '0 0 0 3px rgba(79,70,229,0.18)',
      },
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      animation: {
        'fade-in':   'fadeIn 200ms ease-out',
        shimmer:     'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(2px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
