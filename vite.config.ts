import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@designcodeio/threeui/style.css": path.resolve(__dirname, "src/shaders/threeui.css"),
      "@designcodeio/threeui": path.resolve(__dirname, "src/shaders/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
  build: {
    outDir: "dist",
  },
});
