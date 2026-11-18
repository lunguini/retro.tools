import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// https://vitejs.dev/config/
export default defineConfig({
  // Set BASE_PATH=/repo-name/ when deploying to GitHub Pages project sites.
  base: process.env.BASE_PATH ?? "/",
  plugins: [svelte()],
  define: {
    global: "window", // hack for dragula
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("yjs") || id.includes("trystero")) {
            return "p2p";
          }
          if (id.includes("crypto-js")) {
            return "crypto-js";
          }
          if (id.includes("svelte-feather-icons")) {
            return "icons";
          }
        },
      },
    },
  },
});
