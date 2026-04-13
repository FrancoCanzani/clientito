import fs from "node:fs/promises";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrationsFolder } from "../../../../drizzle.client.config";

const outFile = "src/frontend/db/migrations/export.json";

await fs.writeFile(
  outFile,
  JSON.stringify(readMigrationFiles({ migrationsFolder }), null, 0),
  { flag: "w" },
);

console.info(`✅ Exported client migrations to ${outFile}`);
