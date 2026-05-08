import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? "dev"),
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  worker: {
    format: "es",
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/frontend/routes",
      generatedRouteTree: "./src/frontend/routeTree.gen.ts",
    }),
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    tailwindcss(),
    cloudflare({
      persistState: {
        path: "./.wrangler/state",
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
    },
    dedupe: ["react", "react-dom"],
  },
});
