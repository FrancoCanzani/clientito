import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/frontend/routes",
      generatedRouteTree: "./src/frontend/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
    cloudflare({
      persistState: {
        path: "./.wrangler/state",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
    },
    dedupe: ["react", "react-dom"],
  },
});
