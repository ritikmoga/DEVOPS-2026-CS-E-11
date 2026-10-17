import { defineConfig } from "vite";

const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:5000";

const proxy = {
  "/api": { target: API_TARGET, changeOrigin: true, secure: false },
  "/health": { target: API_TARGET, changeOrigin: true, secure: false },
};

export default defineConfig({
  server: { host: true, port: 5174, proxy },
  preview: { host: true, port: 4174, proxy },
});
