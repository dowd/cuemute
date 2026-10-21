import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// in dev, the UI runs on Vite and talks to the cuescript server on 4001
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": "http://127.0.0.1:4001",
      "/ws": { target: "ws://127.0.0.1:4001", ws: true },
    },
  },
});
