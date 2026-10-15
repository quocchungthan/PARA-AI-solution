import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./", // relative: works at /, /PARA-AI-solution/ and /PARA-AI-solution/<tool>/
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
