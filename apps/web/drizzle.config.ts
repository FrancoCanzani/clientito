import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: ["./src/worker/db/schema.ts", "./src/worker/db/auth-schema.ts"],
  dialect: "sqlite",
});
