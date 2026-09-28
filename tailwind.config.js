/**
 * Design tokens — the single vocabulary every screen uses.
 *
 * Components never say "slate-200"; they say `border-border`, `bg-surface`,
 * `text-muted`. The actual color values live as CSS variables in index.css,
 * with a `.dark` override block. Flipping the whole app to dark mode later
 * is therefore ONE class on <html> — zero component changes. That is the
 * "dark-mode-ready architecture" required by the spec.
 *
 * `<alpha-value>` keeps Tailwind's opacity modifiers (bg-primary/10) working
 * with our variables.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)', // page background
        surface: 'rgb(var(--color-surface) / <alpha-value>)', // cards, panels
        border: 'rgb(var(--color-border) / <alpha-value>)',
        text: 'rgb(var(--color-text) / <alpha-value>)', // primary text
        muted: 'rgb(var(--color-muted) / <alpha-value>)', // secondary text
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          hover: 'rgb(var(--color-primary-hover) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          hover: 'rgb(var(--color-danger-hover) / <alpha-value>)',
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
      },
      /**
       * Elevation scale — soft, indigo-tinted shadows (never pure black, per
       * our design laws). Depth is how the "elevated minimal" look reads on a
       * light surface; components pick a rung (shadow-xs … shadow-xl) instead
       * of hand-rolling box-shadows.
       */
      boxShadow: {
        xs: '0 1px 2px 0 rgb(30 27 75 / 0.05)',
        sm: '0 1px 3px 0 rgb(30 27 75 / 0.07), 0 1px 2px -1px rgb(30 27 75 / 0.06)',
        md: '0 4px 14px -3px rgb(30 27 75 / 0.10), 0 2px 6px -3px rgb(30 27 75 / 0.06)',
        lg: '0 14px 32px -8px rgb(30 27 75 / 0.16), 0 6px 14px -8px rgb(30 27 75 / 0.10)',
        xl: '0 28px 56px -14px rgb(30 27 75 / 0.26)',
        // A focused glow for the primary CTA — used sparingly.
        glow: '0 8px 24px -8px rgb(79 70 229 / 0.50)',
      },
      // Exponential ease-outs only (no bounce/elastic) — see design laws.
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'overlay-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'dialog-in': {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'overlay-in': 'overlay-in 0.2s ease-out',
        'dialog-in': 'dialog-in 0.32s cubic-bezier(0.16, 1, 0.3, 1)',
        'rise-in': 'rise-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slide-in-left 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
