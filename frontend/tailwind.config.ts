import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#E8092E',
          'red-dark': '#B80725',
          'red-glow': 'rgba(232, 9, 46, 0.4)',
        },
        dark: {
          DEFAULT: '#0A0A0A',
          100: '#111111',
          200: '#161616',
          300: '#1C1C1C',
          400: '#222222',
          500: '#2A2A2A',
        },
        light: {
          DEFAULT: '#FFFFFF',
          muted: '#9CA3AF',
          dim: '#6B7280',
        },
      },
      fontFamily: {
        actay: ['Actay', 'sans-serif'],
        sans: ['Actay', 'sans-serif'],
        bold: ['ActayWide', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M0 0v40M40 0v40M0 0h40M0 40h40' stroke='%23ffffff08' stroke-width='1'/%3E%3C/svg%3E\")",
      },
      animation: {
        'pulse-red': 'pulse-red 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 5px rgba(232, 9, 46, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(232, 9, 46, 0.8)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
