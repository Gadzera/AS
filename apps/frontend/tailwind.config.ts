import type { Config } from 'tailwindcss';

// Дизайн-токены AISDR — «Bold» светлый SaaS: насыщенный индиго-бренд (#4f46e5)
// + виолет/фуксия акценты, цветные теги, крупная типографика, глубокие тени.
// Имена ключей сохранены (bg/surface/line/ink/brand/accent) — компоненты завязаны на них.
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // M23-2: структурные токены через CSS-переменные (rgb-каналы + <alpha-value> → opacity-модификаторы работают,
        // напр. bg-surface-2/40). Переключаются в dark через html.dark в globals.css.
        bg:            'rgb(var(--bg-rgb) / <alpha-value>)',
        surface:       'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2':   'rgb(var(--surface-2-rgb) / <alpha-value>)',
        'surface-3':   'rgb(var(--surface-3-rgb) / <alpha-value>)',
        sidebar:       'rgb(var(--sidebar-rgb) / <alpha-value>)',
        line:          'rgb(var(--border-rgb) / <alpha-value>)',
        'line-strong': 'rgb(var(--border-strong-rgb) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
          muted:   'rgb(var(--text-muted-rgb) / <alpha-value>)',
          subtle:  'rgb(var(--text-subtle-rgb) / <alpha-value>)',
        },
        // Bold indigo (Tailwind-indigo-подобная шкала, насыщенная)
        brand: {
          50:  '#eef0ff',
          100: '#e0e3ff',
          200: '#c6ccff',
          300: '#a4adff',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#2c2780',
        },
        accent: {
          violet:  '#8b5cf6',
          fuchsia: '#d946ef',
          cyan:    '#06b6d4',
          mint:    '#10b981',
          amber:   '#f59e0b',
          rose:    '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        xs:    '0 1px 2px rgba(20,23,41,0.06), 0 1px 1px rgba(20,23,41,0.04)',
        sm:    '0 8px 20px rgba(20,23,41,0.08), 0 2px 6px rgba(20,23,41,0.05)',
        md:    '0 16px 40px rgba(20,23,41,0.12), 0 6px 14px rgba(79,70,229,0.10)',
        lg:    '0 30px 80px rgba(20,23,41,0.16), 0 12px 30px rgba(79,70,229,0.14)',
        brand: '0 12px 26px rgba(79,70,229,0.32), 0 4px 10px rgba(79,70,229,0.22)',
        focus: '0 0 0 4px rgba(99,102,241,0.22), 0 0 0 1px rgba(79,70,229,0.45)',
      },
      borderRadius: {
        md:   '10px',
        lg:   '14px',
        xl:   '20px',
        '2xl':'26px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        shimmer:   'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '220% 0' },
          '100%': { backgroundPosition: '-220% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
