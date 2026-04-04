import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve("./node_modules/react"),
      "react-dom": path.resolve("./node_modules/react-dom"),
    },
    dedupe: ["react", "react-dom"],
  },   // ← comma here was missing

  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
  /*build: {
    sourcemap: false,
    minify: "esbuild",
  },*/
  build: {
    sourcemap: true,
    minify: false,
  },
}));
