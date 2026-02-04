/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        /* Onshape-style dark theme */
        'onshape': {
          'bg': '#252526',      /* main panel */
          'bg-elevated': '#2d2d2d',
          'bg-input': '#3c3c3c',
          'border': '#3c3c3c',
          'text': '#cccccc',
          'text-muted': '#858585',
          'accent': '#0066cc',
          'accent-hover': '#0e639c',
          'hover': '#2a2d2e',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
