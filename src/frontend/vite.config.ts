import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.join(rootDir, "src") },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.API_INTERNAL_URL || "http://localhost:8000",
        changeOrigin: true,
        rewrite: (url) => url.replace(/^\/api/, ""),
      },
    },
  },
});
