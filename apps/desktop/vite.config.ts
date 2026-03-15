import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_NUMBER__: JSON.stringify(process.env.BUILD_NUMBER || "dev"),
  },
  server: {
    port: 1420,
    strictPort: true
  }
});

