import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";

dotenv.config(); // Load .env before Prisma reads it

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
