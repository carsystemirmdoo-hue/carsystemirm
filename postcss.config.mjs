const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // Hex rezerve za oklch() i -webkit-mask za Chrome/Edge 109 (Windows 7/8.1) i Safari 15.4.
    "./scripts/postcss/legacy-browser-fallbacks.cjs": {},
  },
};

export default config;
