/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    // The shop and employee shells are vendored into this binary and style with
    // className strings too — without these globs their classes are never
    // generated and every one of their screens renders unstyled.
    './shop/src/**/*.{js,jsx,ts,tsx}',
    './employee/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary — emerald green
        primary: {
          DEFAULT: '#004C40',
          light: '#00695C',
          dark: '#003830',
          soft: '#DCFCE7',
          // A real teal ramp. The scale was left half-converted by the sweep -
          // 400/800/900 were still Tailwind green under a teal DEFAULT, so any
          // future `bg-primary-800` would have painted green.
          50:  '#E6F0EE',
          100: '#DCFCE7',
          200: '#B2D8D0',
          300: '#7FB8AE',
          400: '#4D9A8C',
          500: '#00695C',
          600: '#004C40',
          700: '#004037',
          800: '#003830',
          900: '#002A24',
        },
        // Accent — vivid orange
        accent: {
          DEFAULT: '#FF7A00',
          light: '#FF9A3D',
          dark: '#E56A00',
          soft: '#FFEDD5',
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#FF7A00',
          600: '#E56A00',
          700: '#C2410C',
          800: '#9A3412',
          900: '#7C2D12',
        },
        /* ── Tokens added for the vendored shells ────────────────────────────
         * Tailwind resolves ONE config for the whole binary, so a token name
         * means the same thing in every shell. These three are ADDITIVE — the
         * customer app uses none of them, so adding them cannot restyle it.
         *
         * Two conflicts were resolved by renaming classes in the vendored trees
         * instead of by overloading a token here:
         *   • employee `primary` is navy, customer/shop `primary` is teal — the
         *     employee tree now says `bg-navy` / `text-navy` / `border-navy`.
         *   • employee `secondary` is royal blue — now `bg-royal` / `text-royal`.
         *   • shop `secondary` resolved to the SAME hex as its `primary`
         *     (#004C40), so the shop tree just says `primary` now. Deliberately
         *     NOT defined here: the customer app has 21 `-secondary` classes
         *     that are inert today, and defining the token would make them paint.
         */
        // Attention — shop shell's pending/warning amber. Takes DARK text
        // (white on it is 2.1:1); kept separate from `accent` because this app's
        // accent role already means something else.
        attention: {
          DEFAULT: '#F59E0B',
          light: '#FCD34D',
          dark: '#B45309',
          soft: '#FEF3C7',
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
        },
        // Navy — the employee shell's brand colour (its own app's `primary`).
        navy: {
          DEFAULT: '#00008B',
          light: '#1E1EAC',
          dark: '#00006B',
          50: '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
        // Royal — the employee shell's secondary blue.
        royal: {
          DEFAULT: '#2563EB',
          light: '#3B82F6',
          dark: '#1D4ED8',
        },

        // Surfaces
        background: '#FFFFFF',
        card: '#FFFFFF',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F3F5',
        },
        // Text
        text: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
          subtle: '#94A3B8',
        },
        // Lines
        border: {
          DEFAULT: '#E5E7EB',
          strong: '#D1D5DB',
        },
        // Status
        success: '#004C40',
        warning: '#F59E0B',
        danger: '#EF4444',
        error: '#EF4444',
        info: '#0EA5E9',
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
