
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const apiTarget = env.VITE_API_TARGET || "http://localhost:5000";

  const proxyConfig = {
    target: apiTarget,
    changeOrigin: true,
    secure: false,
  };

  const proxy = {
    "/api": { ...proxyConfig },
    "/health": { ...proxyConfig },
  };

  return {
    server: {
      host: "0.0.0.0",
      port: 5174,
      strictPort: true,
      proxy,
    },
    preview: {
      host: "0.0.0.0",
      port: 4174,
      strictPort: true,
      proxy,
    },
  };
});
