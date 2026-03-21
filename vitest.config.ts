import { cloudflarePool } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    dir: "tests",
    globals: true,
    pool: cloudflarePool({
      wrangler: {
        configPath: "./wrangler.test.json",
      },
      miniflare: {
        bindings: {
          GOOGLE_CLIENT_ID: "test-client-id",
          GOOGLE_CLIENT_SECRET: "test-client-secret",
          BETTER_AUTH_SECRET: "test-auth-secret",
          BETTER_AUTH_URL: "http://localhost:8787",
          OPENAI_API_KEY: "test-openai-key",
        },
      },
    }),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/frontend"),
    },
  },
});
