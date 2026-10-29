/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MediChain brand palette
        teal: {
          50:  "#f0fdfa",
          100: "#ccfbf1",
          200: "#99f6e4",
          300: "#5eead4",
          400: "#2dd4bf",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow":  "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-green":  "glowGreen 2s ease-in-out infinite alternate",
        "glow-red":    "glowRed 2s ease-in-out infinite alternate",
        "glow-amber":  "glowAmber 2s ease-in-out infinite alternate",
        "slide-up":    "slideUp 0.4s ease-out",
        "fade-in":     "fadeIn 0.5s ease-out",
        "spin-slow":   "spin 2s linear infinite",
      },
      keyframes: {
        glowGreen: {
          "0%":   { boxShadow: "0 0 10px rgba(34,197,94,0.3)" },
          "100%": { boxShadow: "0 0 30px rgba(34,197,94,0.7), 0 0 60px rgba(34,197,94,0.3)" },
        },
        glowRed: {
          "0%":   { boxShadow: "0 0 10px rgba(239,68,68,0.3)" },
          "100%": { boxShadow: "0 0 30px rgba(239,68,68,0.7), 0 0 60px rgba(239,68,68,0.3)" },
        },
        glowAmber: {
          "0%":   { boxShadow: "0 0 10px rgba(245,158,11,0.3)" },
          "100%": { boxShadow: "0 0 30px rgba(245,158,11,0.7), 0 0 60px rgba(245,158,11,0.3)" },
        },
        slideUp: {
          from: { opacity: 0, transform: "translateY(20px)" },
          to:   { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: 0 },
          to:   { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
