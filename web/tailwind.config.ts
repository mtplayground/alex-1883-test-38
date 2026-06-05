import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213d",
        coral: "#ef476f",
        mint: "#06d6a0"
      }
    }
  },
  plugins: []
} satisfies Config;
