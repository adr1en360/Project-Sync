import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The build writes to `web/dist`, and `main.py` sends those files. The base path
// is the root, because the service holds the interface and the API together on
// one origin.
//
// The proxy is for development only. `npm run dev` gives the page, and it sends
// each API call to the FastAPI process on port 8080. A build does not use the
// proxy, because the same process then sends both the page and the API.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: false },
      "/healthz": { target: "http://127.0.0.1:8080", changeOrigin: false },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
