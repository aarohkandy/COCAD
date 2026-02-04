/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        'onshape-blue': '#0066cc',
        'onshape-dark': '#1a1a1a',
      },
    },
  },
  plugins: [],
}
