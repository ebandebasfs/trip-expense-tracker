import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 does not read .env on its own. Load it here if present.
const envFile = join(__dirname, '.env');
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

export default defineConfig({
  schema: join(__dirname, 'prisma', 'schema.prisma'),
  migrations: {
    path: join(__dirname, 'prisma', 'migrations'),
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
