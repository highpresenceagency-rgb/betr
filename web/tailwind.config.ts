import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0C0C0C',
        'bg-page': '#060606',
        card: '#161616',
        inp: '#111111',
        accent: '#39FF7A',
        'accent-dark': '#0D1F11',
        'text-primary': '#EFEFEF',
        'text-secondary': '#D0D0D0',
        'text-dim': '#555555',
        'text-muted': '#333333',
        danger: '#F87171',
        amber: '#F59E0B',
      },
      borderRadius: {
        sm: '8px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
