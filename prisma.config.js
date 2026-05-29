import path from 'path'
import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    async adapter() {
      const { PrismaMsSql } = await import('@prisma/adapter-mssql')
      return new PrismaMsSql({ connectionString: process.env.DATABASE_URL })
    },
  },
})