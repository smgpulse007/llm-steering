import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/llm-steering/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          markdown: ["react-markdown", "remark-gfm", "remark-math", "rehype-highlight", "rehype-katex", "katex"]
        }
      }
    }
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  }
});
