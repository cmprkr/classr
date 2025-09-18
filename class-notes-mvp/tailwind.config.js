/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      fontFamily: {
        sans: "var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system",
        mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco",
      },
    },
  },
  plugins: [],
};
