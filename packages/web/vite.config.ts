import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// in dev, the UI runs on Vite and talks to the server on 4000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4000",
      "/ws": { target: "ws://127.0.0.1:4000", ws: true },
    },
  },
});
