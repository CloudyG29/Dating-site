const { PrismaMsSql } = require('@prisma/adapter-mssql')
const { PrismaClient } = require('@prisma/client')

const adapter = new PrismaMsSql({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

module.exports = { prisma }