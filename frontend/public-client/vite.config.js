import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true,
    port: 5173,

    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },

      "/health": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    target: "es2020",
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1000,
  },

  preview: {
    host: true,
    port: 4173,
  },
});
