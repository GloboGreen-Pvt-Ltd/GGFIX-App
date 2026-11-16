/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // GGShopIndia palette (see src/theme/colors.js). Lighter steps are the
        // colour blended with white.
        primary: { DEFAULT: '#035C6C', light: '#035C6C', dark: '#035C6C', soft: '#E5F3F5', 50: '#E5F3F5', 100: '#E5F3F5', 200: '#C7E6EA', 300: '#9ABEC4', 400: '#035C6C', 500: '#035C6C', 600: '#035C6C', 700: '#035C6C', 800: '#035C6C', 900: '#035C6C' },
        accent: { DEFAULT: '#FAA700', light: '#FAA700', dark: '#FAA700', soft: '#FFF4D6', 50: '#FFF4D6', 100: '#FFF4D6', 200: '#FDE3A3', 300: '#FDE3A3', 400: '#FAA700', 500: '#FAA700', 600: '#FAA700', 700: '#FAA700', 800: '#FAA700', 900: '#FAA700' },
        background: '#FFFFFF',
        card: '#FFFFFF',
        surface: { DEFAULT: '#FFFFFF', muted: '#F3F4F6' },
        text: { DEFAULT: '#1C3053', muted: '#606E87', subtle: '#8E97A9' },
        border: { DEFAULT: '#E8EAEE', strong: '#D2D6DD' },
        success: '#609138',
        warning: '#FAA700',
        danger: '#F32C26',
        error: '#F32C26',
        info: '#0788C9',
        navy: '#1C3053',
        link: '#0788C9',
        ink: '#111111',
        lightgray: '#F3F4F6',
      },
      fontFamily: {
        sans: ['System'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '28px',
      },
    },
  },
  plugins: [],
};
