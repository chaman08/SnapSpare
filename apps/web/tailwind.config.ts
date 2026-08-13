import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const withOpacity =
  (cssVar: string) =>
  ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `rgb(var(${cssVar}))`
      : `rgb(var(${cssVar}) / ${opacityValue})`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: withOpacity('--ink'),
        steel: withOpacity('--steel'),
        signal: withOpacity('--signal'),
        verify: withOpacity('--verify'),
        alert: withOpacity('--alert'),
        surface: {
          DEFAULT: withOpacity('--surface'),
          muted: withOpacity('--surface-muted'),
        },
      },
      fontFamily: {
        heading: ['"Saira Condensed"', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
      spacing: {
        // 8px grid, named steps in addition to Tailwind's default scale
        18: '4.5rem',
      },
      minHeight: {
        tap: '44px',
      },
      minWidth: {
        tap: '44px',
      },
      screens: {
        xs: '360px',
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config
