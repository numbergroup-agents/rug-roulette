/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'rug-pull': 'rugPull 0.5s ease-in forwards',
        'survivor-glow': 'survivorGlow 1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        rugPull: {
          '0%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
          '100%': { transform: 'translateY(200px) rotate(45deg)', opacity: '0' },
        },
        survivorGlow: {
          '0%, 100%': { boxShadow: '0 0 20px #22c55e' },
          '50%': { boxShadow: '0 0 40px #22c55e, 0 0 60px #22c55e' },
        },
      },
    },
  },
  plugins: [],
};
