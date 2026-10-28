import { defineConfig } from "vite";

const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:5000";

const createProxy = () => ({
  target: API_TARGET,
  changeOrigin: true,
});

const proxy = {
  "/api": createProxy(),
  "/health": createProxy(),
};

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy,
  },

  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    proxy,
  },

  build: {
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
});
