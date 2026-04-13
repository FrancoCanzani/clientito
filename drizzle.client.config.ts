import { defineConfig } from "drizzle-kit";

const base = "./src/frontend/db";

export default defineConfig({
  dialect: "sqlite",
  schema: `${base}/schema.ts`,
  verbose: false,
});
